# Deploy ComplianceTwin (public URL like localhost:8000)

Vercel often fails for this repo (Python + large `rules/` + corpus + LLM timeouts). Use one of these instead.

## Recommended: Render (Docker)

Confirm GitHub is current: https://github.com/sannawt/compliance_calculator/commits/main  
(latest should be **today**, not ~18 days ago).

1. Push `main` to GitHub (includes `Dockerfile`, `render.yaml`, `build/`, `data/legal_graph/`).
2. [Render](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect `sannawt/compliance_calculator`, branch **`main`**, and apply `render.yaml`.
4. In the service → **Environment**, set:
   - `OPENAI_API_KEY` (optional)
   - `NEO4J_PLAYBOOK_PASSWORD` (optional, for company playbooks)
5. Wait for deploy; open the `*.onrender.com` URL.

Health check: `https://<host>/api/health`  
UI check: `https://<host>/` should show ComplianceTwin (not “Compliance question”).

Free tier may sleep after inactivity; first request can take ~30s.

## Docker on your own VPS / cloud VM

```bash
git clone https://github.com/sannawt/compliance_calculator.git
cd compliance_calculator
# optional: echo 'OPENAI_API_KEY=sk-...' >> .env.local
docker compose up --build -d
```

Open `http://<server-ip>:8000/`. Put nginx/Caddy in front for HTTPS if needed.

## Share your local `make run` (no cloud deploy)

```bash
# terminal 1
make run

# terminal 2
brew install cloudflared   # once
make share
```

Send the printed HTTPS URL to collaborators. Stops when you close the tunnel or shut down your Mac.

Alternative: [ngrok](https://ngrok.com) — `ngrok http 8000` while `make run` is active.

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `LEGAL_GRAPH_BACKEND` | No | `local` uses `data/legal_graph/*.csv` (default in Docker/Render) |
| `OPENAI_API_KEY` | No | Chat summaries, lawyer view |
| `LLM_FACTS_SUMMARY` | No | `1` to enable |
| `LLM_SCOPE_SUMMARY` | No | `1` to enable |
| `NEO4J_PLAYBOOK_*` | No | Company playbook graph |

Never commit `.env.local`.

## Render still shows a repo “updated 18 days ago”

GitHub **is** updated; Render is serving an **old deploy** or the wrong service type.

1. Open your **Web Service** (not Static Site) → **Events** tab.
2. Check the commit hash on the last successful deploy. If it is `38170bc` or from May 9, you are on the initial commit.
3. **Manual Deploy** → **Deploy latest commit** (top right on the service page).
4. **Settings** → **Build & Deploy**:
   - **Branch:** `main`
   - **Auto-Deploy:** On
   - **Root Directory:** empty (repo root)
   - **Runtime:** Docker (must match `render.yaml`; not “Python” only unless you change the setup)
5. If there is no **Deploy latest commit**, or the repo looks frozen:
   - **Settings** → **Delete Web Service** (or disconnect)
   - **New** → **Blueprint** → select `sannawt/compliance_calculator` again → **Apply**
6. Reconnect GitHub if needed: Account Settings → **GitHub** → reconnect `sannawt`.

After a good deploy, **Events** should show commit `657b032` or newer and a Docker build log including `npm run build`.

Verify live app:

- `https://<your-service>.onrender.com/api/ui-meta` → `"ui": "compliance_twin"`
- `/` → ComplianceTwin chat UI (not “Compliance question”)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Render repo date stale in picker | Ignore the picker date; use **Deploy latest commit** on the service |
| Old “Compliance question” page | Old commit deployed; redeploy `main` with Docker (see above) |
| Wrong deploy root or old commit | Use Docker/Render, not static-only hosting |
| 503 / corpus error on startup | Ensure `build/corpus.dl` and `build/*.json` are in the image (committed in git) |
| API works, blank UI | Frontend build failed; check Docker build logs for `npm run build` |
| `Account bootstrap failed (500)` | UI is static but `/api/*` is down. On **Vercel**, use **Render + Docker** instead, or redeploy after the corpus/account deploy fixes on `main`. Check `https://<host>/api/health` — if it errors, the Python API did not start. |
| Timeouts on chat | Increase host timeout (Render paid) or disable LLM env flags |
