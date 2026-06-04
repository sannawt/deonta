# Deploy ComplianceTwin on Vercel

Vercel serves the **React UI** from `frontend/dist` and runs **FastAPI** as a Python serverless function at `/api/*`.

## Build failed / wrong “Initial commit”

If the Vercel deployment shows commit **`3f3ac20`** or message **“Initial commit”**, the project is **not** connected to the current repo.

**Fix in Vercel → Project → Settings → Git:**

| Field | Value |
|--------|--------|
| Repository | `sannawt/compliance_calculator` |
| Production branch | `main` |

Then **Deployments → Redeploy** and confirm the commit is **`cb8f64c`** or newer (message mentions ComplianceTwin, Docker, or Vercel).

Correct repo URL: **https://github.com/sannawt/compliance_calculator**

If the deploy still fails with `cd frontend` / `npm ci`, you are still on an old commit without `frontend/`.

**Prefer Render (Docker)** for this app — see [DEPLOY.md](DEPLOY.md).

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

5. **Important:** In **Settings → Build & Deploy**, clear any custom **Install Command** / **Build Command** overrides.  
   If the log shows `pip install -r requirements.txt && cd frontend && npm ci`, the dashboard is overriding `vercel.json` — delete those overrides and redeploy.

6. Latest `vercel.json` only runs `cd frontend && npm ci` (Python deps install automatically for `api/index.py`).

## Verify after deploy

- `https://<your-app>.vercel.app/` → ComplianceTwin product app (marketing-minimal UI, no chat)
- `POST /api/products/assess` → structured applicability (canonical)
- `GET /api/laws` → EU law catalog
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
