"""Account-scoped company playbooks (JSON persistence)."""

from __future__ import annotations

import json
import secrets
import time
from pathlib import Path
from typing import Any, Optional

from logic.account_store import account_dir, ensure_account, normalize_account_id
from logic.kg_schema import empty_graph, graph_edge, graph_node, new_node_id

PLAYBOOK_VERSION = 1


def _playbook_path(account_id: str, playbook_id: str) -> Path:
    return account_dir(account_id) / "playbooks" / f"{playbook_id}.json"


def _now_ms() -> int:
    return int(time.time() * 1000)


def new_playbook_id() -> str:
    return "pb_" + secrets.token_hex(8)


def list_playbooks(account_id: str) -> list[dict[str, Any]]:
    ensure_account(account_id)
    root = account_dir(account_id) / "playbooks"
    rows: list[dict[str, Any]] = []
    for path in sorted(root.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        rows.append(
            {
                "playbook_id": data.get("playbook_id") or path.stem,
                "name": data.get("name") or path.stem,
                "updated_at": data.get("updated_at"),
                "node_count": len(data.get("nodes") or []),
            }
        )
    return rows


def create_playbook(account_id: str, name: str) -> dict[str, Any]:
    ensure_account(account_id)
    pid = new_playbook_id()
    now = _now_ms()
    company_node = graph_node(
        node_id=new_node_id("co"),
        node_type="Company",
        label=(name or "My company").strip() or "My company",
        source="seed",
    )
    doc = {
        "version": PLAYBOOK_VERSION,
        "playbook_id": pid,
        "account_id": account_id,
        "name": (name or "My company").strip() or "My company",
        "created_at": now,
        "updated_at": now,
        "nodes": [company_node],
        "edges": [],
        "documents": [],
    }
    _save(doc)
    return doc


def get_playbook(account_id: str, playbook_id: str) -> Optional[dict[str, Any]]:
    path = _playbook_path(account_id, playbook_id)
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def update_playbook(account_id: str, playbook_id: str, patch: dict[str, Any]) -> Optional[dict[str, Any]]:
    doc = get_playbook(account_id, playbook_id)
    if not doc:
        return None
    if "name" in patch and patch["name"]:
        doc["name"] = str(patch["name"]).strip()
    if "nodes" in patch and isinstance(patch["nodes"], list):
        doc["nodes"] = patch["nodes"]
    if "edges" in patch and isinstance(patch["edges"], list):
        doc["edges"] = patch["edges"]
    doc["updated_at"] = _now_ms()
    _save(doc)
    return doc


def append_playbook_nodes(
    account_id: str,
    playbook_id: str,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]] | None = None,
    *,
    document_meta: dict[str, Any] | None = None,
) -> Optional[dict[str, Any]]:
    doc = get_playbook(account_id, playbook_id)
    if not doc:
        return None
    existing_ids = {n.get("id") for n in doc.get("nodes") or []}
    company_id = None
    for n in doc.get("nodes") or []:
        if n.get("type") == "Company":
            company_id = n.get("id")
            break
    for node in nodes:
        if node.get("id") in existing_ids:
            continue
        doc.setdefault("nodes", []).append(node)
        existing_ids.add(node.get("id"))
        if company_id and node.get("type") != "Company":
            doc.setdefault("edges", []).append(
                graph_edge(from_id=company_id, to_id=node["id"], edge_type="HAS_CONTEXT")
            )
    if edges:
        for e in edges:
            doc.setdefault("edges", []).append(e)
    if document_meta:
        doc.setdefault("documents", []).append(document_meta)
    doc["updated_at"] = _now_ms()
    _save(doc)
    return doc


def _save(doc: dict[str, Any]) -> None:
    account_id = doc["account_id"]
    playbook_id = doc["playbook_id"]
    ensure_account(account_id)
    path = _playbook_path(account_id, playbook_id)
    path.write_text(json.dumps(doc, indent=2, default=str), encoding="utf-8")


def playbook_as_graph(doc: dict[str, Any]) -> dict[str, list]:
    return {
        "nodes": list(doc.get("nodes") or []),
        "edges": list(doc.get("edges") or []),
    }


def rank_playbook_nodes_for_terms(
    doc: dict[str, Any],
    terms: list[str],
    *,
    cap: int = 12,
) -> list[dict[str, Any]]:
    """Simple term overlap ranking for account playbook nodes."""
    terms_l = [t.lower() for t in terms if len(t) >= 3][:12]
    if not terms_l:
        return (doc.get("nodes") or [])[:cap]

    scored: list[tuple[int, dict[str, Any]]] = []
    for node in doc.get("nodes") or []:
        if node.get("type") == "Company":
            continue
        blob = f"{node.get('label','')} {json.dumps(node.get('properties') or {})}".lower()
        hits = sum(1 for t in terms_l if t in blob)
        if hits > 0:
            scored.append((hits, node))
    scored.sort(key=lambda x: -x[0])
    return [n for _, n in scored[:cap]]


def playbook_matches_for_assess(
    account_id: str,
    playbook_id: str,
    terms: list[str],
) -> dict[str, Any]:
    """Shape compatible with fetch_playbook_matches for assess pipeline."""
    doc = get_playbook(account_id, playbook_id)
    if not doc:
        return {"matches": [], "error": "playbook not found", "match_count": 0, "company_id": playbook_id}
    ranked = rank_playbook_nodes_for_terms(doc, terms)
    matches = []
    for node in ranked:
        matches.append(
            {
                "labels": [node.get("type") or "PlaybookNode"],
                "id": node.get("id"),
                "properties": {
                    **(node.get("properties") or {}),
                    "label": node.get("label"),
                    "source": node.get("source", "playbook"),
                },
            }
        )
    return {
        "matches": matches,
        "error": None,
        "match_count": len(matches),
        "company_id": playbook_id,
        "account_playbook": True,
        "playbook_name": doc.get("name"),
    }
