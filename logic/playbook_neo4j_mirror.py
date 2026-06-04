"""Optional mirror of account playbooks to Neo4j (Phase D)."""

from __future__ import annotations

import os
from typing import Any, Optional


def mirror_enabled() -> bool:
    return bool((os.environ.get("NEO4J_PLAYBOOK_PASSWORD") or "").strip())


def label_prefix(account_id: str, playbook_id: str) -> str:
    safe_a = account_id.replace("-", "")[:16]
    safe_p = playbook_id.replace("-", "_")[:24]
    return f"UP_{safe_a}_{safe_p}_"


def mirror_playbook_to_neo4j(
    doc: dict[str, Any],
    *,
    driver: Any = None,
    database: str = "neo4j",
) -> dict[str, Any]:
    """
    Best-effort upsert of playbook nodes. No-op when Neo4j env missing.
    """
    if not mirror_enabled():
        return {"mirrored": False, "reason": "NEO4J_PLAYBOOK_PASSWORD not set"}
    account_id = doc.get("account_id") or ""
    playbook_id = doc.get("playbook_id") or ""
    prefix = label_prefix(account_id, playbook_id)
    try:
        if driver is None:
            from neo4j import GraphDatabase

            uri = os.environ["NEO4J_PLAYBOOK_URI"]
            user = os.environ.get("NEO4J_PLAYBOOK_USER", "neo4j")
            password = os.environ["NEO4J_PLAYBOOK_PASSWORD"]
            driver = GraphDatabase.driver(uri, auth=(user, password))
        count = 0
        with driver.session(database=database) as session:
            for node in doc.get("nodes") or []:
                label = f"{prefix}{node.get('type') or 'Node'}"
                session.run(
                    f"MERGE (n:`{label}` {{id: $id}}) SET n.label = $label, n.props = $props",
                    id=node.get("id"),
                    label=node.get("label"),
                    props=node.get("properties") or {},
                )
                count += 1
        return {"mirrored": True, "nodes": count, "prefix": prefix}
    except Exception as e:  # noqa: BLE001
        return {"mirrored": False, "error": f"{type(e).__name__}: {e}"}
