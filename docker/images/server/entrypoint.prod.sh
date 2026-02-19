#!/bin/bash
# Docker entrypoint script for Pierre MCP Server - Production
set -e

echo "=== Pierre MCP Server - Starting ==="
echo "Database: ${DATABASE_URL:0:30}..."
echo "Port: ${HTTP_PORT:-8081}"
echo "Log level: ${RUST_LOG:-info}"
echo "User: $(whoami)"

# Create data directory if needed
mkdir -p /app/data

# ── Garmin auto-refresh cron job (6:50 every morning) ──
GARMIN_CRON_ENABLED="${GARMIN_CRON_ENABLED:-true}"
if [ "$GARMIN_CRON_ENABLED" = "true" ] && [ -f /app/scripts/fetch_garmin_live.py ]; then
  echo "Setting up Garmin auto-refresh cron job at 06:50..."

  # Build the cron environment file with all needed vars
  CRON_ENV="/tmp/garmin_cron_env.sh"
  cat > "$CRON_ENV" <<ENVEOF
export GARMIN_EMAIL="${GARMIN_EMAIL}"
export GARMIN_PASSWORD="${GARMIN_PASSWORD}"
export GARTH_HOME="${GARTH_HOME:-/app/data/.garth}"
export WELLNESS_OUTPUT_PATH="${WELLNESS_OUTPUT_PATH:-/app/data/wellness_summary.json}"
export GEMINI_API_KEY="${GEMINI_API_KEY}"
export PIERRE_LLM_DEFAULT_MODEL="${PIERRE_LLM_DEFAULT_MODEL:-gemini-2.5-flash}"
export STRAVA_CLIENT_ID="${STRAVA_CLIENT_ID}"
export STRAVA_CLIENT_SECRET="${STRAVA_CLIENT_SECRET}"
export STRAVA_REFRESH_TOKEN="${STRAVA_REFRESH_TOKEN}"
ENVEOF

  # Create the cron wrapper script
  cat > /tmp/garmin_refresh.sh <<'SCRIPT'
#!/bin/bash
source /tmp/garmin_cron_env.sh
echo "[$(date)] Starting Garmin data refresh..."
python3 /app/scripts/fetch_garmin_live.py >> /tmp/garmin_cron.log 2>&1
EXIT_CODE=$?
echo "[$(date)] Garmin refresh finished (exit code: $EXIT_CODE)"
SCRIPT
  chmod +x /tmp/garmin_refresh.sh

  # Start background scheduler (simple loop, no cron daemon needed)
  (
    while true; do
      # Calculate seconds until next 06:50
      NOW=$(date +%s)
      TARGET=$(date -d "today 06:50" +%s 2>/dev/null || date -d "06:50" +%s 2>/dev/null)
      if [ "$TARGET" -le "$NOW" ]; then
        # Already past 06:50 today, schedule for tomorrow
        TARGET=$((TARGET + 86400))
      fi
      SLEEP_SECS=$((TARGET - NOW))
      echo "[Garmin scheduler] Next refresh in ${SLEEP_SECS}s ($(date -d @$TARGET '+%Y-%m-%d %H:%M' 2>/dev/null || echo 'tomorrow 06:50'))"
      sleep "$SLEEP_SECS"
      /tmp/garmin_refresh.sh
    done
  ) &
  echo "Garmin auto-refresh scheduler started (PID: $!)"
fi

# Execute the server
exec "$@"
