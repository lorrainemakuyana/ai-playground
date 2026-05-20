#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Colours ──────────────────────────────────
BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RESET="\033[0m"

log()  { echo -e "${BOLD}${CYAN}▶ $*${RESET}"; }
ok()   { echo -e "${GREEN}✔ $*${RESET}"; }
warn() { echo -e "${YELLOW}⚠ $*${RESET}"; }

# ── Cleanup on exit ───────────────────────────
PIDS=()
cleanup() {
  echo ""
  log "Shutting down servers..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  ok "All servers stopped."
}
trap cleanup EXIT INT TERM

# ── Backend setup ─────────────────────────────
log "Setting up backend..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  warn ".venv not found — creating virtual environment..."
  python3 -m venv .venv
  ok "Virtual environment created."
fi

# shellcheck disable=SC1091
source .venv/bin/activate
ok "Virtual environment activated."

log "Installing backend dependencies..."
pip install -r requirements.txt -q
ok "Backend dependencies installed."

if [ ! -f ".env" ]; then
  warn "No .env file found in backend/. Create one with ANTHROPIC_API_KEY=your_key"
fi

# ── Frontend setup ────────────────────────────
log "Setting up frontend..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  warn "node_modules not found — running npm install..."
  npm install --silent
  ok "Frontend dependencies installed."
else
  log "Installing frontend dependencies..."
  npm install --silent
  ok "Frontend dependencies up to date."
fi

# ── Start servers ─────────────────────────────
echo ""
echo -e "${BOLD}Starting servers...${RESET}"
echo ""

cd "$ROOT/backend"
# shellcheck disable=SC1091
source .venv/bin/activate
uvicorn main:app --reload --port 8000 2>&1 | sed "s/^/  ${CYAN}[backend]${RESET}  /" &
PIDS+=($!)
ok "Backend  → http://localhost:8000"

cd "$ROOT/frontend"
npm run dev 2>&1 | sed "s/^/  ${GREEN}[frontend]${RESET} /" &
PIDS+=($!)
ok "Frontend → http://localhost:3000"

echo ""
echo -e "${BOLD}Both servers running. Press Ctrl+C to stop.${RESET}"
echo ""

# Wait for either process to exit
wait "${PIDS[@]}"
