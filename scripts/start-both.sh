#!/usr/bin/env bash
# Stop duplicate listeners, then start main (:8000) and prototype (:8001).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_DIR="$ROOT/.local-logs"
mkdir -p "$LOG_DIR"

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping processes on :$port ($pids)"
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

kill_port 8000
kill_port 8001

if [ ! -f frontend/dist/index.html ]; then
  echo "Building frontend…"
  make frontend
fi

nohup bash scripts/run-instance.sh main >"$LOG_DIR/main-8000.log" 2>&1 &
MAIN_PID=$!
nohup bash scripts/run-instance.sh prototype >"$LOG_DIR/prototype-8001.log" 2>&1 &
PROTO_PID=$!

sleep 2

check() {
  local port="$1"
  local name="$2"
  if curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null; then
    local meta
    meta=$(curl -sf "http://127.0.0.1:${port}/api/ui-meta")
    echo "OK  :$port $name — $(echo "$meta" | python3 -c "import sys,json; m=json.load(sys.stdin); print(m.get('instance'), 'prototype_mode='+str(m.get('prototype_mode')))")"
  else
    echo "FAIL :$port $name — see $LOG_DIR"
    return 1
  fi
}

check 8000 "main" || true
check 8001 "prototype" || true

echo ""
echo "Main workbench:  http://127.0.0.1:8000/  (pid $MAIN_PID, log $LOG_DIR/main-8000.log)"
echo "Prototype demo:  http://127.0.0.1:8001/  (pid $PROTO_PID, log $LOG_DIR/prototype-8001.log)"
