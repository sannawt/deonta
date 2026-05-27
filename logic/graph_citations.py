"""
Heuristic bucketing of Neo4j retrieval rows for UI citations (Phase 4 thin layer).

Does not query the graph by relationship — uses string/label signals on matched
nodes so the legal graph can *explain* dimensions without a dedicated graph schema.
"""

from __future__ import annotations

import re
from typing import Any


def _preview(props: dict[str, Any], limit: int = 160) -> str:
    parts: list[str] = []
    for k, v in props.items():
        if v is None:
            continue
        s = str(v).replace("\n", " ").strip()
        if not s:
            continue
        parts.append(f"{k}: {s[:80]}{'…' if len(s) > 80 else ''}")
        if len("; ".join(parts)) >= limit:
            break
    return "; ".join(parts)[:limit] + ("…" if len("; ".join(parts)) > limit else "")


_MAT = re.compile(
    r"personal data|pii|data subject|health data|patient|special category|"
    r"processing|email|names?\b|identif",
    re.I,
)
_TER = re.compile(
    r"\beu\b|european|europe|union|germany|france|finland|netherlands|spain|italy|"
    r"territorial|establishment|market placement|member state",
    re.I,
)
_TMP = re.compile(
    r"entry into force|application date|august 2026|2026-08|temporal|in force|"
    r"phased|deadline|after \d{4}",
    re.I,
)
_EXC = re.compile(
    r"exempt|exclusion|derogation|household|purely personal|carve-out|exception",
    re.I,
)


def bucket_legal_matches(matches: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """
    Return buckets MATERIAL, TERRITORIAL, TEMPORAL, EXCLUSION, GENERAL.
    A node may appear in more than one bucket.
    """
    out: dict[str, list[dict[str, Any]]] = {
        "MATERIAL": [],
        "TERRITORIAL": [],
        "TEMPORAL": [],
        "EXCLUSION": [],
        "GENERAL": [],
    }
    seen: set[tuple[str, str]] = set()

    def _slim(m: dict[str, Any]) -> dict[str, Any]:
        return {
            "labels": m.get("labels") or [],
            "id": m.get("id"),
            "preview": _preview(dict(m.get("properties") or {})),
        }

    for m in matches:
        nid = str(m.get("id") or "")
        labels = " ".join(m.get("labels") or [])
        props = m.get("properties") or {}
        blob = labels + " " + " ".join(str(v) for v in props.values())
        slim = _slim(m)
        placed = False
        for key, rx in (
            ("MATERIAL", _MAT),
            ("TERRITORIAL", _TER),
            ("TEMPORAL", _TMP),
            ("EXCLUSION", _EXC),
        ):
            if rx.search(blob):
                k2 = (key, nid)
                if k2 not in seen:
                    seen.add(k2)
                    out[key].append(slim)
                placed = True
        if not placed:
            k2 = ("GENERAL", nid)
            if k2 not in seen:
                seen.add(k2)
                out["GENERAL"].append(slim)
    return out
