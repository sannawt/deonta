#!/usr/bin/env python3
"""Generate short handles and compact keywords from Neo4j legal document titles.

Reads Document / LegalEntity names from the legal Aura graph and writes a JSON
catalog of display fields (short handle, keywords, official number).

Usage:
  python scripts/generate_law_handles.py
  python scripts/generate_law_handles.py --output data/law_handles.json
  python scripts/generate_law_handles.py --limit 50
  python scripts/generate_law_handles.py --titles-file titles.txt
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from dotenv import load_dotenv

load_dotenv(REPO / ".env")
load_dotenv(REPO / ".env.local", override=True)

from logic.law_title_format import generate_short_handle, parse_document_display

DOCUMENTS_QUERY = """
MATCH (d:Document)
RETURN
  coalesce(d.doc_id, d.id, elementId(d)) AS doc_id,
  coalesce(d.title, d.name, d.long_id, '') AS title,
  coalesce(d.official_number, d.number, d.celex, '') AS official_number
ORDER BY title
"""

LEGAL_ENTITY_QUERY = """
MATCH (le:LegalEntity)
WHERE coalesce(le.name, le.title, '') <> ''
RETURN
  coalesce(le.id, elementId(le)) AS doc_id,
  coalesce(le.name, le.title, '') AS title,
  coalesce(le.official_number, le.number, le.celex, '') AS official_number
ORDER BY title
"""


def _load_titles_from_file(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        title = line.strip()
        if not title or title.startswith("#"):
            continue
        rows.append({"doc_id": f"line_{index}", "title": title, "official_number": ""})
    return rows


def _fetch_neo4j_titles(limit: int = 0) -> list[dict[str, str]]:
    import os

    from main import get_legal_driver, resolve_aura_database

    uri = (os.environ.get("NEO4J_LEGAL_URI") or os.environ.get("NEO4J_URI") or "").strip()
    if not uri:
        raise RuntimeError("NEO4J_LEGAL_URI not set")

    driver = get_legal_driver()
    database = resolve_aura_database(uri, "NEO4J_LEGAL_DATABASE")
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    with driver.session(database=database) as session:
        for query in (DOCUMENTS_QUERY, LEGAL_ENTITY_QUERY):
            result = session.run(query)
            for record in result:
                title = str(record.get("title") or "").strip()
                if not title:
                    continue
                doc_id = str(record.get("doc_id") or title)
                if doc_id in seen:
                    continue
                seen.add(doc_id)
                rows.append(
                    {
                        "doc_id": doc_id,
                        "title": title,
                        "official_number": str(record.get("official_number") or "").strip(),
                    }
                )
                if limit > 0 and len(rows) >= limit:
                    return rows
    return rows


def build_handle_row(title: str, *, official_number: str = "", doc_id: str = "") -> dict:
    display = parse_document_display(title, official_number=official_number)
    keywords = [
        kw.strip()
        for kw in (display.get("description") or "").split(",")
        if kw.strip()
    ]
    return {
        "doc_id": doc_id,
        "title": title,
        "short": display.get("short") or generate_short_handle(title, official_number=official_number),
        "number": display.get("number") or "",
        "catalog_code": display.get("catalog_code") or "",
        "keywords": keywords,
        "full_title": display.get("full_title") or title,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate law short handles and keywords.")
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO / "data" / "law_handles.json",
        help="Write JSON output here (default: data/law_handles.json)",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max documents (0 = all)")
    parser.add_argument(
        "--titles-file",
        type=Path,
        help="Plain-text file with one title per line (skip Neo4j)",
    )
    parser.add_argument("--print", action="store_true", help="Also print a human-readable table")
    args = parser.parse_args()

    if args.titles_file:
        source_rows = _load_titles_from_file(args.titles_file)
    else:
        source_rows = _fetch_neo4j_titles(limit=args.limit)

    documents = [
        build_handle_row(
            row["title"],
            official_number=row.get("official_number") or "",
            doc_id=row.get("doc_id") or "",
        )
        for row in source_rows
    ]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(documents),
        "documents": documents,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(documents)} handles → {args.output}", file=sys.stderr)

    if args.print:
        for row in documents:
            kws = ", ".join(row["keywords"][:5]) or "—"
            print(f"{row['short']:<18} {row['number']:<12} {kws}")
            print(f"  {row['full_title'][:120]}")
            print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
