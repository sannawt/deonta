# Deploy ComplianceTwin (public URL like localhost:8000)

Vercel often fails for this repo (Python + large `rules/` + corpus + LLM timeouts). Use one of these instead.

## Recommended: Render (Docker)

1. Push `main` to GitHub (includes `Dockerfile`, `render.yaml`, `build/`, `data/legal_graph/`).
2. [Render](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect `sannawt/compliance_calculator` and apply `render.yaml`.
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

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Old “Compliance question” page | Wrong deploy root or old commit; use Docker/Render, not static-only hosting |
| 503 / corpus error on startup | Ensure `build/corpus.dl` and `build/*.json` are in the image (committed in git) |
| API works, blank UI | Frontend build failed; check Docker build logs for `npm run build` |
| Timeouts on chat | Increase host timeout (Render paid) or disable LLM env flags |
