"""
Provision title and text from local legal_graph CSVs (and build/citations.json).
"""

from __future__ import annotations

import csv
from functools import lru_cache
from typing import Any

from logic.corpus import load_citations
from logic.local_legal_store import resolve_legal_csv_dir


@lru_cache(maxsize=1)
def _load_csv_provisions() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    csv_dir = resolve_legal_csv_dir()
    for filename in ("articles.csv", "recitals.csv"):
        path = csv_dir / filename
        if not path.is_file():
            continue
        with path.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                plid = (row.get("long_id") or "").strip()
                if not plid:
                    continue
                text = (row.get("text") or "").strip()
                title = (row.get("title") or row.get("name") or "").strip()
                if plid not in out or (text and not out[plid].get("text")):
                    out[plid] = {"title": title, "text": text, "name": (row.get("name") or "").strip()}
    return out


def lookup_provision_record(plid: str) -> dict[str, Any]:
    """Merge citations.json, articles CSV, and caller-provided catalog row."""
    plid = (plid or "").strip()
    if not plid:
        return {}
    cite = (load_citations() or {}).get(plid) or {}
    csv_row = _load_csv_provisions().get(plid) or {}
    title = str(cite.get("title") or csv_row.get("title") or csv_row.get("name") or "").strip()
    text = str(cite.get("text") or csv_row.get("text") or "").strip()
    return {
        "provision_long_id": plid,
        "title": title or None,
        "text": text or None,
        "regulation": cite.get("regulation"),
        "type": cite.get("type"),
    }
