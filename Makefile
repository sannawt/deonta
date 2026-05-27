.PHONY: export-rules test run frontend frontend-dev

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
