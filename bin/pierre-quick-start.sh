#!/bin/bash
# ABOUTME: Quick daily start - launches backend + frontend + Cloudflare tunnel
# ABOUTME: Does NOT reset the database. Just starts services and opens browser.

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

SERVER_PORT=8081
FRONTEND_PORT=5173

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   PIERRE COACH - Demarrage${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# --- Load environment ---
if [ ! -f "$PROJECT_ROOT/.envrc" ]; then
    echo -e "${RED}ERREUR: .envrc introuvable${NC}"
    read -p "Appuyez sur Entree..."
    exit 1
fi
set -a && source "$PROJECT_ROOT/.envrc" && set +a
echo -e "${GREEN}[1/5]${NC} Environnement charge"

# --- Stop old processes ---
taskkill //F //IM pierre-mcp-server.exe >nul 2>&1 || true
taskkill //F //IM cloudflared.exe >nul 2>&1 || true
sleep 2
echo -e "${GREEN}[2/5]${NC} Anciens processus stoppes"

# --- Start backend ---
mkdir -p "$PROJECT_ROOT/data"
export RUST_LOG="${RUST_LOG:-info}"
export HTTP_PORT="${HTTP_PORT:-$SERVER_PORT}"

> "$LOG_DIR/pierre-server.log"

if [ -f "./target/release/pierre-mcp-server.exe" ]; then
    echo -e "${GREEN}[3/5]${NC} Demarrage backend (release)..."
    ./target/release/pierre-mcp-server.exe >> "$LOG_DIR/pierre-server.log" 2>&1 &
else
    echo -e "${GREEN}[3/5]${NC} Demarrage backend (cargo run)..."
    cargo run --bin pierre-mcp-server >> "$LOG_DIR/pierre-server.log" 2>&1 &
fi

echo -n "      Attente du serveur"
for i in $(seq 1 60); do
    if curl -s -f "http://localhost:$SERVER_PORT/health" > /dev/null 2>&1; then
        echo -e " ${GREEN}OK${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e " ${RED}TIMEOUT${NC}"
    fi
    echo -n "."
    sleep 1
done

# --- Start frontend ---
echo -e "${GREEN}[4/5]${NC} Demarrage frontend..."
cd "$PROJECT_ROOT/frontend"
[ ! -d "node_modules" ] && bun install --frozen-lockfile > /dev/null 2>&1
export VITE_BACKEND_URL="${VITE_BACKEND_URL:-http://localhost:$SERVER_PORT}"
> "$LOG_DIR/frontend.log"
bun run dev >> "$LOG_DIR/frontend.log" 2>&1 &
cd "$PROJECT_ROOT"
sleep 4
echo -e "      ${GREEN}Frontend pret${NC}"

# --- Start Cloudflare tunnel ---
TUNNEL_URL=""
CLOUDFLARED_BIN=""
command -v cloudflared > /dev/null 2>&1 && CLOUDFLARED_BIN="cloudflared"
[ -z "$CLOUDFLARED_BIN" ] && [ -f "$HOME/AppData/Local/Microsoft/WinGet/Links/cloudflared.exe" ] && CLOUDFLARED_BIN="$HOME/AppData/Local/Microsoft/WinGet/Links/cloudflared.exe"

if [ -n "$CLOUDFLARED_BIN" ]; then
    echo -e "${GREEN}[5/5]${NC} Demarrage tunnel mobile..."
    > "$LOG_DIR/tunnel.log"
    "$CLOUDFLARED_BIN" tunnel --url "http://localhost:$FRONTEND_PORT" >> "$LOG_DIR/tunnel.log" 2>&1 &

    echo -n "      Attente du tunnel"
    for i in $(seq 1 25); do
        TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_DIR/tunnel.log" 2>/dev/null | head -1)
        if [ -n "$TUNNEL_URL" ]; then
            echo -e " ${GREEN}OK${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    [ -z "$TUNNEL_URL" ] && echo -e " ${YELLOW}non disponible${NC}"
else
    echo -e "${YELLOW}[5/5]${NC} cloudflared absent - pas d'acces mobile"
fi

# --- Open browser ---
start "http://localhost:$FRONTEND_PORT" 2>/dev/null || true

# --- Summary ---
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   PIERRE COACH EST PRET !${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "  ${CYAN}PC :${NC}     http://localhost:$FRONTEND_PORT"
if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo -e "  ${MAGENTA}SMARTPHONE :${NC}  ${TUNNEL_URL}"
fi
echo ""
echo -e "  ${YELLOW}NE FERMEZ PAS CETTE FENETRE${NC}"
echo -e "  ${YELLOW}Appuyez sur Entree pour arreter Pierre${NC}"
echo ""

# --- Wait for user to press Enter ---
read -r

# --- Cleanup ---
echo -e "${YELLOW}Arret de Pierre...${NC}"
taskkill //F //IM pierre-mcp-server.exe >nul 2>&1 || true
taskkill //F //IM cloudflared.exe >nul 2>&1 || true
pkill -f "vite" 2>/dev/null || true
echo -e "${GREEN}Pierre arrete.${NC}"
