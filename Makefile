.PHONY: export-rules test run run-main run-both frontend frontend-dev docker-up share

export-rules:
	.venv/bin/python scripts/export_rules_xlsx.py

test:
	.venv/bin/pip install -q -r requirements-dev.txt
	.venv/bin/pytest -q

CURSOR_NODE = /Applications/Cursor.app/Contents/Resources/app/resources/helpers/node
NODE := $(shell which node 2>/dev/null || echo $(CURSOR_NODE))

frontend:
	cd frontend && $(NODE) node_modules/.bin/vite build

frontend-dev:
	cd frontend && PORT=$(PORT) $(NODE) node_modules/.bin/vite

# Two local instances from this checkout (or run each in a separate repo clone):
#   make run-main      → http://127.0.0.1:8000/  (Neo4j scan, full scope)
#   make run           → http://127.0.0.1:8001/  (prototype / SmartRoof demo)
#   make run-both      → start both (stops anything already on 8000/8001)
PORT ?= 8001

run: frontend-check
	@bash scripts/run-instance.sh prototype

run-main: frontend-check
	@bash scripts/run-instance.sh main

run-both: frontend-check
	@bash scripts/start-both.sh

frontend-check:
	@test -f frontend/dist/index.html || (echo "Building workbench UI (first time)…" && $(MAKE) frontend)

# Same app as `make run`, in Docker (good for VPS / Render image smoke test).
docker-up:
	docker compose up --build

# Public HTTPS link anyone can open (works on public Wi‑Fi). Run `make run` first.
share:
	@bash scripts/share-public.sh
