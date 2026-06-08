#!/usr/bin/env bash
# Start one ComplianceTwin instance: prototype (:8001) or main (:8000).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INSTANCE="${1:-prototype}"

set -a
[ -f .env ] && . ./.env
[ -f .env.local ] && . ./.env.local
set +a

case "$INSTANCE" in
  prototype)
    export PORT=8001
    export APP_INSTANCE=prototype
    export UI_MODE=both
    export PROTOTYPE_MODE=1
    PEER="http://127.0.0.1:8000/"
    ;;
  main)
    export PORT=8000
    export APP_INSTANCE=main
    export UI_MODE=both
    export PROTOTYPE_MODE=0
    PEER="http://127.0.0.1:8001/"
    ;;
  *)
    echo "Usage: $0 {prototype|main}" >&2
    exit 1
    ;;
esac

echo "ComplianceTwin ${APP_INSTANCE} → http://127.0.0.1:${PORT}/ (peer: ${PEER})"
exec .venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port "$PORT"
