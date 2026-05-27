#!/usr/bin/env bash
# Print deploy diagnostics (local vs GitHub vs what Render needs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Local git ==="
git rev-parse --short HEAD
git log -1 --format='%ci %s'
echo "ahead/behind origin/main:" "$(git rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo '?')"
echo "remote:" "$(git remote get-url origin 2>/dev/null || echo none)"

echo ""
echo "=== GitHub (public API) ==="
if command -v python3 >/dev/null 2>&1; then
  python3 <<'PY'
import json, urllib.request
repo = "sannawt/compliance_calculator"
r = json.load(urllib.request.urlopen(f"https://api.github.com/repos/{repo}"))
c = json.load(urllib.request.urlopen(f"https://api.github.com/repos/{repo}/commits/main"))
print("pushed_at:", r.get("pushed_at"))
print("main HEAD:", c["sha"][:12])
print("main date:", c["commit"]["committer"]["date"])
print("message:", c["commit"]["message"].split("\n")[0])
for path in ("frontend/src/App.tsx", "Dockerfile", "render.yaml", "api/index.py"):
    u = f"https://api.github.com/repos/{repo}/contents/{path}?ref=main"
    try:
        urllib.request.urlopen(u)
        print("on main:", path, "YES")
    except Exception:
        print("on main:", path, "NO")
PY
else
  echo "(install python3 for GitHub checks)"
fi

echo ""
echo "=== Production app (not static/index.html at /) ==="
echo "UI: frontend/ built to frontend/dist (main.py serves /)"
echo "Legacy debug page: /legacy only"
echo ""
echo "Render fix: Web Service + Docker + branch main + Deploy latest commit"
echo "If Events show commit 38170bc, delete service and New -> Blueprint."
