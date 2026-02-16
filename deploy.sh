#!/bin/bash
# Pierre MCP Server - Production Deployment Script
# Usage: ./deploy.sh [SSH_HOST] [SSH_PORT] [SSH_USER]
#
# Prerequisites:
#   - SSH access to the target server
#   - Docker and Docker Compose installed on the server
#   - .envrc file present in the project root (for secrets)
set -euo pipefail

# ============================================================
# Configuration
# ============================================================
SSH_HOST="${1:-82.25.117.39}"
SSH_PORT="${2:-22}"
SSH_USER="${3:-root}"
SSH_KEY="${SSH_KEY:-}"

REMOTE_DIR="/opt/pierre"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# SSH command helper
ssh_cmd() {
    local ssh_opts="-o StrictHostKeyChecking=no -o ConnectTimeout=15 -p ${SSH_PORT}"
    if [ -n "${SSH_KEY}" ]; then
        ssh_opts="${ssh_opts} -i ${SSH_KEY}"
    fi
    ssh ${ssh_opts} "${SSH_USER}@${SSH_HOST}" "$@"
}

scp_cmd() {
    local scp_opts="-o StrictHostKeyChecking=no -o ConnectTimeout=15 -P ${SSH_PORT}"
    if [ -n "${SSH_KEY}" ]; then
        scp_opts="${scp_opts} -i ${SSH_KEY}"
    fi
    scp ${scp_opts} "$@"
}

# ============================================================
# Step 0: Pre-flight checks
# ============================================================
log "Pre-flight checks..."

# Check SSH connectivity
log "Testing SSH connection to ${SSH_USER}@${SSH_HOST}:${SSH_PORT}..."
ssh_cmd "echo SSH_OK" || error "Cannot connect via SSH. Check your credentials."

# Check Docker on remote
ssh_cmd "docker --version && docker compose version" || error "Docker not found on remote server."

# ============================================================
# Step 1: Prepare production .env from .envrc
# ============================================================
log "Preparing production environment..."

ENV_FILE="${PROJECT_DIR}/docker/compose/.env"

if [ -f "${PROJECT_DIR}/.envrc" ]; then
    log "Generating .env from .envrc..."
    # Extract key variables from .envrc
    source "${PROJECT_DIR}/.envrc" 2>/dev/null || true

    cat > "${ENV_FILE}" <<ENVEOF
# Auto-generated from .envrc - $(date)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
PIERRE_MASTER_ENCRYPTION_KEY=${PIERRE_MASTER_ENCRYPTION_KEY:-$(openssl rand -base64 32)}
RUST_LOG=info
PIERRE_DEFAULT_PROVIDER=${PIERRE_DEFAULT_PROVIDER:-strava}
PIERRE_STRAVA_CLIENT_ID=${PIERRE_STRAVA_CLIENT_ID:-${STRAVA_CLIENT_ID:-}}
PIERRE_STRAVA_CLIENT_SECRET=${PIERRE_STRAVA_CLIENT_SECRET:-${STRAVA_CLIENT_SECRET:-}}
STRAVA_REDIRECT_URI=http://${SSH_HOST}/api/oauth/callback/strava
GARMIN_EMAIL=${GARMIN_EMAIL:-}
GARMIN_PASSWORD=${GARMIN_PASSWORD:-}
PIERRE_GARMIN_CLIENT_ID=${PIERRE_GARMIN_CLIENT_ID:-}
PIERRE_GARMIN_CLIENT_SECRET=${PIERRE_GARMIN_CLIENT_SECRET:-}
PIERRE_LLM_PROVIDER=${PIERRE_LLM_PROVIDER:-gemini}
GEMINI_API_KEY=${GEMINI_API_KEY:-}
PIERRE_LLM_DEFAULT_MODEL=${PIERRE_LLM_DEFAULT_MODEL:-gemini-2.5-flash}
PIERRE_LLM_FALLBACK_MODEL=${PIERRE_LLM_FALLBACK_MODEL:-gemini-2.5-flash}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@pierre.mcp}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-$(openssl rand -base64 16 | tr -d '/+=')}
ENVEOF

    log "Production .env generated at ${ENV_FILE}"
    log "IMPORTANT: Note the POSTGRES_PASSWORD and ADMIN_PASSWORD in ${ENV_FILE}"
else
    if [ ! -f "${ENV_FILE}" ]; then
        error "No .envrc found and no .env exists. Create ${ENV_FILE} from .env.production template."
    fi
    warn "Using existing .env file"
fi

# ============================================================
# Step 2: Create remote directory structure
# ============================================================
log "Setting up remote directories..."
ssh_cmd "mkdir -p ${REMOTE_DIR}"

# ============================================================
# Step 3: Sync project files to server
# ============================================================
log "Syncing project files to ${SSH_HOST}:${REMOTE_DIR}..."

# Create a tar of necessary files (excluding large/unnecessary dirs)
cd "${PROJECT_DIR}"
tar czf /tmp/pierre-deploy.tar.gz \
    --exclude='target' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='frontend/node_modules' \
    --exclude='packages/*/node_modules' \
    --exclude='*.db' \
    --exclude='garmin_data_extract' \
    --exclude='garmin_extract' \
    --exclude='strava_upload_batches' \
    --exclude='frontend-mobile' \
    --exclude='book' \
    --exclude='benches' \
    --exclude='test_data' \
    --exclude='.claude' \
    .

log "Uploading project archive (this may take a few minutes)..."
scp_cmd /tmp/pierre-deploy.tar.gz "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

log "Extracting on server..."
ssh_cmd "cd ${REMOTE_DIR} && tar xzf pierre-deploy.tar.gz && rm pierre-deploy.tar.gz"

# Clean up local temp file
rm -f /tmp/pierre-deploy.tar.gz

# ============================================================
# Step 4: Build and deploy
# ============================================================
log "Building Docker images on server (this takes 10-20 minutes for Rust compilation)..."
ssh_cmd "cd ${REMOTE_DIR}/docker/compose && docker compose -f docker-compose.deploy.yml build --no-cache pierre-server"

log "Starting services..."
ssh_cmd "cd ${REMOTE_DIR}/docker/compose && docker compose -f docker-compose.deploy.yml up -d"

# Wait for services to be healthy
log "Waiting for services to start..."
sleep 15

# ============================================================
# Step 5: Verify deployment
# ============================================================
log "Verifying deployment..."

# Check all containers are running
ssh_cmd "docker ps --filter 'name=pierre-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Check health endpoint
log "Testing health endpoint..."
for i in 1 2 3 4 5; do
    if ssh_cmd "curl -sf http://localhost/health" 2>/dev/null; then
        log "Health check PASSED!"
        break
    fi
    warn "Health check attempt $i failed, retrying in 10s..."
    sleep 10
done

# Show logs
log "Recent logs:"
ssh_cmd "docker logs pierre-server --tail 20" 2>&1 || true

# ============================================================
# Done
# ============================================================
echo ""
echo "=========================================="
log "Deployment complete!"
echo "=========================================="
echo ""
echo "  Frontend: http://${SSH_HOST}"
echo "  API:      http://${SSH_HOST}/api/"
echo "  Health:   http://${SSH_HOST}/health"
echo ""
echo "  Admin credentials in: ${ENV_FILE}"
echo ""
echo "  Useful commands:"
echo "    ssh ${SSH_USER}@${SSH_HOST} -p ${SSH_PORT}"
echo "    cd ${REMOTE_DIR}/docker/compose"
echo "    docker compose -f docker-compose.deploy.yml logs -f"
echo "    docker compose -f docker-compose.deploy.yml restart"
echo ""
