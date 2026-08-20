#!/usr/bin/env bash
# ============================================================
# Z-DASH start script (macOS / Linux)
#   Start the backend server and open the browser.
# Usage:  ./bin/start.sh [port]    # default 8000
# If the port is taken, try another: ./bin/start.sh 8001
# ============================================================
set -e

cd "$(dirname "$0")/.."

PORT="${1:-8000}"

# Check node availability
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node not found. Install Node.js 18+ first: https://nodejs.org"
  exit 1
fi

echo "==> Starting Z-DASH backend (node server.js $PORT)"
node server.js "$PORT" &
SERVER_PID=$!

# Wait for the port, then open browser
sleep 1
if command -v open >/dev/null 2>&1; then
  open "http://localhost:${PORT}/"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:${PORT}/"
fi

echo "==> Running at http://localhost:${PORT}/"
echo "==> Press Ctrl+C to stop"
wait "$SERVER_PID"
