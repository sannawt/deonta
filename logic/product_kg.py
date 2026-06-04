"""Build product knowledge graph by merging parse output with account playbook."""

from __future__ import annotations

import re
from typing import Any, Optional

from logic.kg_schema import graph_edge, graph_node
from logic.playbook_merge import get_playbook, rank_playbook_nodes_for_terms
from logic.predicate_facts import graph_to_predicate_facts
from logic.product_parse import kg_nodes_to_facts, parse_product_input


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in re.findall(r"[a-zA-Z]{4,}", text)][:24]


def link_playbook_nodes(
    product_nodes: list[dict[str, Any]],
    playbook_doc: dict[str, Any],
    *,
    cap: int = 8,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Add playbook nodes and alignment edges to product graph."""
    blob = " ".join(
        f"{n.get('label','')} {n.get('properties',{})}" for n in product_nodes
    )
    terms = _tokenize(blob)
    ranked = rank_playbook_nodes_for_terms(playbook_doc, terms, cap=cap)
    extra_nodes: list[dict[str, Any]] = []
    extra_edges: list[dict[str, Any]] = []
    product_ids = [
        n["id"]
        for n in product_nodes
        if n.get("type") in ("Product", "Scenario")
    ]
    anchor = product_ids[0] if product_ids else None

    for pb in ranked:
        link_id = f"pb_{pb.get('id')}"
        extra_nodes.append(
            graph_node(
                node_id=link_id,
                node_type=pb.get("type") or "PlaybookContext",
                label=pb.get("label") or "Playbook",
                properties=pb.get("properties") or {},
                source="playbook",
                playbook_node_id=pb.get("id"),
            )
        )
        if anchor:
            extra_edges.append(
                graph_edge(
                    from_id=anchor,
                    to_id=link_id,
                    edge_type="ALIGNED_WITH",
                    label="playbook context",
                )
            )
            extra_edges.append(
                graph_edge(
                    from_id=link_id,
                    to_id=pb.get("id") or link_id,
                    edge_type="SOURCED_FROM",
                )
            )
    return extra_nodes, extra_edges


def build_product_kg(
    *,
    account_id: str,
    playbook_id: Optional[str],
    description: str = "",
    files: list[tuple[str, bytes]] | None = None,
    manual_nodes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    parsed = parse_product_input(description=description, files=files or [])
    nodes = list(parsed.get("nodes") or [])
    edges = list(parsed.get("edges") or [])

    playbook_doc = None
    if playbook_id and account_id:
        playbook_doc = get_playbook(account_id, playbook_id)
        if playbook_doc:
            pb_nodes, pb_edges = link_playbook_nodes(nodes, playbook_doc)
            nodes.extend(pb_nodes)
            edges.extend(pb_edges)

    if manual_nodes:
        existing = {n.get("id") for n in nodes}
        for mn in manual_nodes:
            if mn.get("id") not in existing:
                mn = {**mn, "source": mn.get("source") or "manual"}
                nodes.append(mn)
                existing.add(mn.get("id"))

    scenario_id = next(
        (n.get("id") for n in nodes if n.get("type") in ("Product", "Scenario")),
        "scenario",
    )
    predicate_facts = graph_to_predicate_facts(nodes, edges, case_id=str(scenario_id))
    facts = kg_nodes_to_facts(nodes, predicate_facts=predicate_facts)
    for f in facts:
        if f.get("source") == "parse":
            f["provenance"] = "parse"
        elif f.get("source") == "playbook":
            f["provenance"] = "playbook"
        else:
            f["provenance"] = f.get("source") or "manual"

    return {
        "version": 1,
        "nodes": nodes,
        "edges": edges,
        "facts": facts,
        "predicate_facts": predicate_facts,
        "spec": {
            "name": parsed.get("name") or "",
            "summary": parsed.get("summary") or description,
            "markets": parsed.get("markets") or [],
            "processesPersonalData": parsed.get("processesPersonalData", "unknown"),
            "euLink": parsed.get("euLink", "unknown"),
            "aiSystem": parsed.get("aiSystem", "unknown"),
        },
        "playbook_id": playbook_id,
        "playbook_linked": bool(playbook_doc),
    }


def merge_kg_patch(
    kg: dict[str, Any],
    patch_nodes: list[dict[str, Any]] | None = None,
    patch_edges: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    nodes = list(kg.get("nodes") or [])
    edges = list(kg.get("edges") or [])
    by_id = {n["id"]: n for n in nodes if n.get("id")}
    if patch_nodes:
        for n in patch_nodes:
            if n.get("id"):
                n = {**n, "source": n.get("source") or "manual"}
                by_id[n["id"]] = n
    nodes = list(by_id.values())
    if patch_edges:
        seen = {(e.get("from"), e.get("to"), e.get("type")) for e in edges}
        for e in patch_edges:
            key = (e.get("from"), e.get("to"), e.get("type"))
            if key not in seen:
                edges.append(e)
                seen.add(key)
    scenario_id = next(
        (n.get("id") for n in nodes if n.get("type") in ("Product", "Scenario")),
        "scenario",
    )
    predicate_facts = graph_to_predicate_facts(nodes, edges, case_id=str(scenario_id))
    facts = kg_nodes_to_facts(nodes, predicate_facts=predicate_facts)
    out = {**kg, "nodes": nodes, "edges": edges, "facts": facts, "predicate_facts": predicate_facts}
    return out
