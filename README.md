# ComplianceTwin

EU regulatory scope and applicability (GDPR, EU AI Act) with a symbolic engine, local legal graph, and optional LLM summaries.

## Give anyone a public link

### Today (from your Mac, ~1 minute)

Works on **public Wi‑Fi** — the tunnel goes *out* to the internet; you do not open router ports.

```bash
make run          # terminal 1 — leave running
make share        # terminal 2 — copy the https://….trycloudflare.com URL
```

One-time install: `brew install cloudflared`

Send that **https** link to anyone. It stops when you close terminal 2 or shut down `make run`.

### Always on (no laptop needed)

Deploy once on **[Render](https://render.com)** (free tier): Dashboard → **New** → **Blueprint** → repo `sannawt/compliance_calculator` → add `OPENAI_API_KEY` → use the `*.onrender.com` URL.

Step-by-step: [DEPLOY.md](DEPLOY.md)

---

## Run locally (your machine)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env.local   # add OPENAI_API_KEY, Neo4j passwords as needed
make run
```

Open **http://localhost:8001/** — this repo’s **prototype** (fast applicability scan + SmartRoof demo).

### Two local instances (two repos)

| Instance | Typical repo | Port | URL |
|----------|----------------|------|-----|
| **Prototype** (catalog scan, demo scope) | `compliance_calculator` (this checkout) | **8001** | http://localhost:8001/ |
| **Main workbench** (full Neo4j scan, LLM scope) | main ComplianceTwin repo | **8000** | http://localhost:8000/ |

Set `PORT` and `APP_INSTANCE` in each repo’s `.env`. The header shows **Prototype :8001** or the port you’re on.

**One checkout, two terminals** (only one repo on disk):

```bash
make run-main    # terminal 1 → http://localhost:8000/
make run         # terminal 2 → http://localhost:8001/
```

Or start both in the background: `make run-both`

## Let others use the same app (three options)

### Option A — Public URL from your laptop (fastest, ~2 minutes)

Good for demos and a small team while you keep developing locally.

1. In one terminal: `make run`
2. In another: `make share`

`make share` prints a **https://….trycloudflare.com** (or similar) link anyone can open. Your computer must stay on and the server running.

Install the tunnel tool once: `brew install cloudflared` (macOS).

### Option B — Docker on any server (recommended for a stable link)

Same UI and API as localhost, runs without your laptop.

```bash
docker compose up --build
```

Then open **http://localhost:8000/** on that machine, or the server’s public IP / hostname on port 8000.

Deploy the same image to [Render](https://render.com):

1. New → **Blueprint** → connect `sannawt/compliance_calculator`
2. Add secrets in the dashboard (`OPENAI_API_KEY`, optional Neo4j)
3. Use the generated `https://compliance-twin.onrender.com` URL

See [DEPLOY.md](DEPLOY.md) for Render and env details.

### Option C — Vercel (static UI + serverless API)

See [VERCEL.md](VERCEL.md). This stack is heavier on Vercel than Docker/Render; prefer **Option B** if Vercel builds fail or APIs time out.

## Tests

```bash
make test
```

## Legacy UI

http://localhost:8000/legacy — older compliance checker page.
