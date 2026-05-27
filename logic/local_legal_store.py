"""
Local legal graph backed by Neo4j-export CSV files (articles, recitals, rules, facts).

Replaces Aura Neo4j for legal retrieval when LEGAL_GRAPH_BACKEND=local or when
data/legal_graph/*.csv exists and no backend override is set.
"""

from __future__ import annotations

import csv
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parent.parent
DEFAULT_CSV_DIR = REPO / "data" / "legal_graph"
FALLBACK_CSV_DIR = REPO.parent / "art_test" / "neo4j_csv"

_NODE_FILES: tuple[tuple[str, str], ...] = (
    ("regulations.csv", "Regulation"),
    ("articles.csv", "Article"),
    ("recitals.csv", "Recital"),
    ("facts.csv", "Fact"),
    ("rules.csv", "Rule"),
)


def resolve_legal_csv_dir() -> Path:
    raw = (os.environ.get("LEGAL_GRAPH_CSV_DIR") or "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    if DEFAULT_CSV_DIR.is_dir() and any(DEFAULT_CSV_DIR.glob("*.csv")):
        return DEFAULT_CSV_DIR
    if FALLBACK_CSV_DIR.is_dir():
        return FALLBACK_CSV_DIR
    return DEFAULT_CSV_DIR


def legal_graph_backend() -> str:
    explicit = (os.environ.get("LEGAL_GRAPH_BACKEND") or "").strip().lower()
    if explicit in ("local", "neo4j"):
        return explicit
    csv_dir = resolve_legal_csv_dir()
    if csv_dir.is_dir() and any(csv_dir.glob("*.csv")):
        return "local"
    return "neo4j"


def local_legal_available() -> bool:
    csv_dir = resolve_legal_csv_dir()
    return csv_dir.is_dir() and any(csv_dir.glob("*.csv"))


@lru_cache(maxsize=1)
def _load_nodes() -> tuple[dict[str, Any], ...]:
    csv_dir = resolve_legal_csv_dir()
    nodes: list[dict[str, Any]] = []
    for filename, label in _NODE_FILES:
        path = csv_dir / filename
        if not path.is_file():
            continue
        with path.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                node_id = (row.get("id") or "").strip()
                if not node_id:
                    continue
                labels = [label]
                extra = (row.get("type") or "").strip()
                if extra and extra not in labels:
                    labels.append(extra)
                nodes.append(
                    {
                        "labels": labels,
                        "id": node_id,
                        "properties": {k: v for k, v in row.items() if v not in (None, "")},
                    }
                )
    return tuple(nodes)


def _node_matches(node: dict[str, Any], terms: list[str]) -> bool:
    props = node.get("properties") or {}
    haystacks: list[str] = []
    for v in props.values():
        if v is None:
            continue
        s = str(v).strip()
        if s:
            haystacks.append(s.lower())
    haystacks.append(" ".join(node.get("labels") or []).lower())
    blob = " ".join(haystacks)
    return any(t in blob for t in terms)


def fetch_local_legal_matches(
    terms: list[str], *, limit: int = 40
) -> list[dict[str, Any]]:
    """Same shape as Neo4j ``fetch_matches`` rows after ``record_to_dict``."""
    terms_l = [t.lower() for t in terms if t and str(t).strip()]
    if not terms_l:
        return []
    out: list[dict[str, Any]] = []
    for node in _load_nodes():
        if _node_matches(node, terms_l):
            out.append(node)
        if len(out) >= limit:
            break
    return out
