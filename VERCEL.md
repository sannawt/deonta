# Deploy ComplianceTwin on Vercel

Vercel serves the **React UI** from `frontend/dist` and runs **FastAPI** as a Python serverless function at `/api/*`.

## Before first deploy

1. **Push the full app to GitHub** (not only `static/`):
   - `frontend/` (source)
   - `logic/`, `main.py`, `api/index.py`
   - `data/legal_graph/*.csv`
   - `build/` corpus artifacts (`corpus.dl`, `*.json`) — required at startup
   - `rules/`, `schemas/`
   - `vercel.json`, `package.json`, `requirements.txt`

2. **Do not commit** `.env.local` or API keys.

3. In the Vercel project → **Settings → Environment Variables**, add at least:
   - `OPENAI_API_KEY` (optional, for chat summaries / lawyer view)
   - `OPENAI_MODEL` = `gpt-4o-mini`
   - `NEO4J_PLAYBOOK_PASSWORD` (optional, company playbooks)
   - `LEGAL_GRAPH_BACKEND` = `local` (if using committed CSVs)
   - `LLM_FACTS_SUMMARY` = `1`, `LLM_SCOPE_SUMMARY` = `1` (optional)

4. **Root Directory**: repo root (not `static/`).

5. Leave **Build** / **Output** empty in the dashboard if using `vercel.json` (recommended).

## Verify after deploy

- `https://<your-app>.vercel.app/` → ComplianceTwin (chat + assessment panel)
- `https://<your-app>.vercel.app/api/health` → JSON health
- `https://<your-app>.vercel.app/api/ui-meta` → `{ "ui": "compliance_twin", ... }`

If `/` still shows the old “Compliance question” page, the deployment is serving an old commit or the wrong root directory.

## Local vs Vercel

| | Local `make run` | Vercel |
|--|------------------|--------|
| UI | FastAPI serves `frontend/dist` | CDN serves `frontend/dist` |
| API | Same process | `api/index.py` → `main.py` |
| Soufflé | Optional | Not installed (Python scope engine only) |

## Render

For a single long-running server (closer to localhost), use Render with start command:

`uvicorn main:app --host 0.0.0.0 --port $PORT`
