#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

run() {
  local label="$1"; shift
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $label"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if "$@"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
}

# ── Backend ──────────────────────────────────
backend() {
  cd "$ROOT/backend"

  if [ ! -d ".venv" ]; then
    echo "No .venv found — creating one..."
    python3 -m venv .venv
  fi

  # shellcheck disable=SC1091
  source .venv/bin/activate

  if ! python3 -c "import pytest" 2>/dev/null; then
    echo "Installing test dependencies..."
    pip install -r requirements-test.txt -q
  fi

  pytest tests/ -v
}

# ── Frontend ─────────────────────────────────
frontend() {
  cd "$ROOT/frontend"

  if [ ! -d "node_modules" ]; then
    echo "node_modules missing — running npm install..."
    npm install --silent
  fi

  npx jest --passWithNoTests --forceExit
}

run "Backend  (pytest)" backend
run "Frontend (jest)  " frontend

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  Results: %s passed" "$PASS"
[ "$FAIL" -gt 0 ] && printf ", %s failed" "$FAIL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

[ "$FAIL" -eq 0 ]
