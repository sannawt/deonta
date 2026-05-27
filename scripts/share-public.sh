#!/usr/bin/env bash
# Print a public HTTPS link to your local ComplianceTwin (http://127.0.0.1:8000).
# Works on public Wi‑Fi (outbound tunnel; no router port forwarding).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8000}"
URL="http://127.0.0.1:${PORT}"

if ! curl -sf --max-time 2 "${URL}/api/health" >/dev/null 2>&1; then
  echo "ComplianceTwin is not running on ${URL}"
  echo ""
  echo "Start it first (in another terminal):"
  echo "  cd ${ROOT}"
  echo "  source .venv/bin/activate   # if you use a venv"
  echo "  make run"
  echo ""
  exit 1
fi

if command -v cloudflared >/dev/null 2>&1; then
  echo "ComplianceTwin is up. Opening public tunnel (Ctrl+C to stop)…"
  echo ""
  echo "  Share the https://….trycloudflare.com URL that appears below."
  echo ""
  exec cloudflared tunnel --url "${URL}"
fi

if command -v ngrok >/dev/null 2>&1; then
  echo "ComplianceTwin is up. Opening ngrok tunnel (Ctrl+C to stop)…"
  exec ngrok http "${PORT}"
fi

echo "Install a tunnel tool (one-time):"
echo "  macOS:  brew install cloudflared"
echo "  or:     brew install ngrok"
echo ""
echo "For a link that works without your laptop, deploy to Render — see DEPLOY.md"
exit 1
