"""Map product KG nodes/edges to extensional Datalog facts (Required facts contract)."""

from __future__ import annotations

import re
from typing import Any

from logic.corpus import extensional_predicates, load_predicate_index, load_rules_index
from logic.fact_payload import ACTOR_ID, fact_row

# Node class → predicate properties (from workbook Nodes/Properties sheets)
_NODE_PREDICATE_PROPS: dict[str, tuple[str, ...]] = {
    "Actor": ("natural_person", "controller", "processor", "provider", "deployer", "importer", "distributor"),
    "Datum": ("concerns", "identifies", "category", "criminal_offence_data", "personal_data"),
    "AISystem": ("provider", "deployer", "has_feature", "has_capability"),
    "Scenario": ("processing", "automated_means", "filing_system"),
    "Product": ("processing", "automated_means"),
}

_EDGE_TO_PREDICATE: dict[str, str] = {
    "PROCESSES_DATA": "processing_concerns",
    "USES_AI": "has_feature",
    "OPERATES_IN": "market",
    "ACTS_AS": "provider",
    "CONCERNS": "concerns",
    "IDENTIFIES": "identifies",
    "CONTROLLER": "controller",
    "PROCESSOR": "processor",
    "PROVIDER": "provider",
    "DEPLOYER": "deployer",
    "IMPORTER": "importer",
    "DISTRIBUTOR": "distributor",
    "IN_CONTEXT_OF_ESTABLISHMENT": "processing_in_context_of_establishment",
}


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", (value or "").lower()).strip("_") or "entity"


def _node_ref(node: dict[str, Any]) -> str:
    ntype = str(node.get("type") or "").strip()
    label = str(node.get("label") or "").strip()
    if ntype == "Actor" and label.lower() in {"your org", "organisation", "organization", "company"}:
        return ACTOR_ID
    if ntype == "Product":
        return _slug(label) or "product"
    if ntype == "Scenario":
        return str(node.get("properties", {}).get("case_id") or _slug(label) or "scenario")
    return _slug(label) or str(node.get("id") or "entity")


def validate_predicate_facts(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only atoms whose predicate exists in the corpus index with matching arity."""
    index = load_predicate_index()
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, tuple[str, ...]]] = set()
    for raw in facts:
        pred = str(raw.get("predicate") or "").strip()
        if not pred or pred not in index:
            continue
        try:
            arity = int(index[pred].get("arity") or 0)
        except (TypeError, ValueError):
            arity = len(raw.get("args") or [])
        args = [str(x) for x in (raw.get("args") or [])][: max(arity, 0)]
        if len(args) != arity:
            continue
        key = (pred, tuple(args))
        if key in seen:
            continue
        seen.add(key)
        row = fact_row(pred, args, source=str(raw.get("source") or "derived"), status=str(raw.get("status") or "derived"))
        if raw.get("description"):
            row["description"] = raw["description"]
        if raw.get("source_articles"):
            row["source_articles"] = raw["source_articles"]
        out.append(row)
    return out


def graph_to_predicate_facts(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]] | None = None,
    *,
    case_id: str = "scenario",
) -> list[dict[str, Any]]:
    """Walk KG nodes/edges and emit extensional predicate facts."""
    edges = edges or []
    index = load_predicate_index()
    by_id = {n["id"]: n for n in nodes if n.get("id")}
    facts: list[dict[str, Any]] = []

    product_ids = {n["id"] for n in nodes if n.get("type") == "Product"}
    scenario_id = case_id

    for node in nodes:
        ntype = str(node.get("type") or "")
        ref = _node_ref(node)
        props = node.get("properties") or {}

        if ntype == "Scenario":
            scenario_id = ref

        for prop_key in _NODE_PREDICATE_PROPS.get(ntype, ()):
            if prop_key not in index:
                continue
            val = props.get(prop_key)
            if val in (None, "", "unknown", "no"):
                continue
            meta = index[prop_key]
            try:
                arity = int(meta.get("arity") or 0)
            except (TypeError, ValueError):
                arity = 1
            if arity == 1:
                if val in ("yes", True, "true"):
                    facts.append(
                        fact_row(prop_key, [ref], source="kg", status="derived")
                    )
                elif isinstance(val, str) and val not in ("yes", "unknown"):
                    facts.append(fact_row(prop_key, [val], source="kg", status="derived"))
            elif arity == 2 and isinstance(val, str) and val not in ("yes", "unknown"):
                facts.append(fact_row(prop_key, [ref, val], source="kg", status="derived"))

        if ntype == "Market":
            market = _slug(str(node.get("label") or ""))
            if market and "market" in index:
                facts.append(fact_row("market", [scenario_id, market], source="kg", status="derived"))
            if market in ("eu", "eea") and "established_in" in index:
                facts.append(fact_row("established_in", [ACTOR_ID, market], source="kg", status="derived"))

        if ntype == "Data" and props.get("personal_data") == "yes":
            datum_id = f"{scenario_id}_datum"
            person_id = f"{scenario_id}_person"
            for pred, args in (
                ("processing_concerns", [scenario_id, datum_id]),
                ("natural_person", [person_id]),
                ("concerns", [datum_id, person_id]),
                ("identifies", [datum_id, person_id]),
            ):
                if pred in index:
                    facts.append(fact_row(pred, args, source="kg", status="derived"))

        if ntype == "AI":
            if "has_feature" in index:
                facts.append(fact_row("has_feature", [scenario_id, "machine_based"], source="kg", status="derived"))
            for cap in ("autonomous_operation", "inference_from_input"):
                if "has_capability" in index:
                    facts.append(fact_row("has_capability", [scenario_id, cap], source="kg", status="derived"))

    for edge in edges:
        etype = str(edge.get("type") or "")
        pred = _EDGE_TO_PREDICATE.get(etype)
        if not pred or pred not in index:
            continue
        src = by_id.get(edge.get("from") or "")
        tgt = by_id.get(edge.get("to") or "")
        if not src or not tgt:
            continue
        src_ref = _node_ref(src)
        tgt_ref = _node_ref(tgt)
        try:
            arity = int(index[pred].get("arity") or 0)
        except (TypeError, ValueError):
            arity = 2
        if arity == 2:
            if etype == "PROCESSES_DATA":
                facts.append(fact_row(pred, [src_ref, tgt_ref], source="kg", status="derived"))
            elif etype == "USES_AI":
                facts.append(fact_row(pred, [src_ref, "machine_based"], source="kg", status="derived"))
            elif etype == "OPERATES_IN":
                market = _slug(str(tgt.get("label") or tgt_ref))
                facts.append(fact_row(pred, [src_ref, market], source="kg", status="derived"))
            elif etype in ("ACTS_AS", "CONTROLLER", "PROCESSOR", "PROVIDER", "DEPLOYER", "IMPORTER", "DISTRIBUTOR"):
                facts.append(fact_row(pred, [src_ref, tgt_ref], source="kg", status="derived"))
            elif etype in ("CONCERNS", "IDENTIFIES"):
                facts.append(fact_row(pred, [src_ref, tgt_ref], source="kg", status="derived"))
            elif etype == "IN_CONTEXT_OF_ESTABLISHMENT":
                facts.append(fact_row(pred, [src_ref, tgt_ref], source="kg", status="derived"))

    if "processing" in index and any(n.get("type") == "Data" for n in nodes):
        facts.append(fact_row("processing", [scenario_id], source="kg", status="derived"))

    for pid in product_ids:
        if "provider" in index:
            facts.append(fact_row("provider", [ACTOR_ID, scenario_id], source="kg", status="derived"))

    return validate_predicate_facts(facts)


def merge_scenario_facts(
    *fact_groups: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for group in fact_groups:
        merged.extend(group or [])
    return validate_predicate_facts(merged)


def _extensional_preds_in_rules(regulation: str) -> set[str]:
    """Extensional predicates referenced in rule bodies for a regulation."""
    ext = {str(r.get("predicate") or "") for r in extensional_predicates()}
    preds: set[str] = set()
    for row in load_rules_index():
        if str(row.get("regulation") or "") != regulation:
            continue
        for pred in row.get("body_predicates") or []:
            if pred in ext:
                preds.add(str(pred))
    return preds


def _present_predicates(facts: list[dict[str, Any]]) -> set[str]:
    return {str(f.get("predicate") or "") for f in facts if f.get("predicate")}


def missing_predicates_for_regulation(
    regulation: str,
    facts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Required extensional predicates for a regulation's rules that are absent from facts."""
    index = load_predicate_index()
    needed = _extensional_preds_in_rules(regulation)
    present = _present_predicates(facts)
    missing: list[dict[str, Any]] = []
    for pred in sorted(needed - present):
        meta = index.get(pred) or {}
        missing.append(
            {
                "predicate": pred,
                "regulation": regulation,
                "dimension": str(meta.get("scope dimension") or "").lower(),
                "description": str(meta.get("description") or pred),
                "example": str(meta.get("example") or ""),
                "source_articles": str(meta.get("source articles") or ""),
            }
        )
    return missing


def missing_predicates_for_regulations(
    regulations: list[str],
    facts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for reg in regulations:
        for row in missing_predicates_for_regulation(reg, facts):
            pred = row["predicate"]
            if pred in seen:
                continue
            seen.add(pred)
            out.append(row)
    return out


def clarifying_questions_from_missing(
    missing: list[dict[str, Any]],
    *,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Turn missing predicate rows into user-facing clarification prompts."""
    questions: list[dict[str, Any]] = []
    for row in missing[:limit]:
        pred = row["predicate"]
        dim = row.get("dimension") or "material"
        reg = row.get("regulation") or ""
        desc = row.get("description") or pred
        qid = f"{reg}_{pred}".replace(" ", "_")
        questions.append(
            {
                "id": qid,
                "regulation": reg,
                "dimension": dim if dim in {"material", "territorial", "temporal", "exclusions"} else "material",
                "predicate": pred,
                "text": desc,
                "example": row.get("example") or "",
                "source_articles": row.get("source_articles") or "",
                "missing_atom": row.get("example") or f"{pred}(…)",
            }
        )
    return questions
