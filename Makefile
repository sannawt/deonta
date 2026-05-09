.PHONY: export-rules test run

export-rules:
	.venv/bin/python scripts/export_rules_xlsx.py

test:
	.venv/bin/pytest -q

run:
	.venv/bin/uvicorn main:app --reload --host 127.0.0.1 --port 8000
