.PHONY: export-rules test run frontend frontend-dev docker-up share

export-rules:
	.venv/bin/python scripts/export_rules_xlsx.py

test:
	.venv/bin/pytest -q

CURSOR_NODE = /Applications/Cursor.app/Contents/Resources/app/resources/helpers/node
NODE := $(shell which node 2>/dev/null || echo $(CURSOR_NODE))

frontend:
	cd frontend && $(NODE) node_modules/.bin/vite build

frontend-dev:
	cd frontend && $(NODE) node_modules/.bin/vite

run: frontend-check
	.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000

frontend-check:
	@test -f frontend/dist/index.html || (echo "Building workbench UI (first time)…" && $(MAKE) frontend)

# Same app as `make run`, in Docker (good for VPS / Render image smoke test).
docker-up:
	docker compose up --build

# Public HTTPS link to your local server — run `make run` in another terminal first.
share:
	@echo "→ In another terminal, start: make run"
	@echo "→ Then this tunnel forwards to http://127.0.0.1:8000"
	@command -v cloudflared >/dev/null 2>&1 || (echo "Install: brew install cloudflared  (or: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)" && exit 1)
	cloudflared tunnel --url http://127.0.0.1:8000
