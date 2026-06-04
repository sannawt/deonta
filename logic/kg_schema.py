"""Shared knowledge-graph JSON schema for playbooks and products."""

from __future__ import annotations

import secrets
from typing import Any


def new_node_id(prefix: str = "n") -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def new_edge_id() -> str:
    return f"e_{secrets.token_hex(6)}"


def empty_graph() -> dict[str, list]:
    return {"nodes": [], "edges": []}


def graph_node(
    *,
    node_id: str | None = None,
    node_type: str,
    label: str,
    properties: dict[str, Any] | None = None,
    source: str = "manual",
    playbook_node_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": node_id or new_node_id(node_type[:3].lower()),
        "type": node_type,
        "label": label,
        "properties": properties or {},
        "source": source,
        "playbook_node_id": playbook_node_id,
    }


def graph_edge(
    *,
    edge_id: str | None = None,
    from_id: str,
    to_id: str,
    edge_type: str,
    label: str = "",
) -> dict[str, Any]:
    return {
        "id": edge_id or new_edge_id(),
        "from": from_id,
        "to": to_id,
        "type": edge_type,
        "label": label or edge_type,
    }
