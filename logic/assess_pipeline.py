"""
Structured product assessment pipeline (no chat UI dependency).
"""

from __future__ import annotations

from typing import Any, Optional

from logic.chat_adapter import build_chat_response
from logic.fact_extractor import propose_scope_facts
from logic.reasoner import run_universal_reasoner
from logic.corpus import load_regulations
from logic.terms import terms_from_question

# Imported from main at runtime to avoid circular imports — callers pass helpers.


def spec_to_situation(spec: dict[str, Any], kg_facts: list[dict[str, Any]] | None = None) -> str:
    name = (spec.get("name") or "").strip() or "Unknown product"
    summary = (spec.get("summary") or "").strip() or "No description provided."
    markets = spec.get("markets") or ["EU"]
    if isinstance(markets, list):
        markets_s = ", ".join(str(m) for m in markets)
    else:
        markets_s = str(markets)

    lines = [
        f"Assess applicable EU laws for this product and provide a defensible scope record with citations.",
        f"Product name: {name}",
        f"Product summary: {summary}",
        f"Markets: {markets_s}",
        "",
        "Signals:",
        f"- Processes personal data: {spec.get('processesPersonalData', 'unknown')}",
        f"- EU territorial link: {spec.get('euLink', 'unknown')}",
        f"- Is an AI system: {spec.get('aiSystem', 'unknown')}",
    ]
    if kg_facts:
        lines.append("")
        lines.append("Product knowledge graph facts:")
        for f in kg_facts[:40]:
            label = f.get("label") or f.get("predicate") or "fact"
            val = f.get("value") or f.get("text") or ""
            prov = f.get("provenance") or f.get("source") or ""
            suffix = f" [{prov}]" if prov else ""
            lines.append(f"- {label}: {val}{suffix}")
    regs = spec.get("regulations") or spec.get("selectedLaws")
    if regs and isinstance(regs, list):
        lines.append("")
        lines.append(f"Focus regulations: {', '.join(str(r) for r in regs)}")
    return "\n".join(lines)


def run_product_assess(
    *,
    spec: dict[str, Any],
    kg_facts: list[dict[str, Any]] | None = None,
    playbook_company_id: Optional[str] = None,
    account_id: Optional[str] = None,
    account_playbook_id: Optional[str] = None,
    case_id: Optional[str] = None,
    fetch_legal_playbook_fn,
    build_fact_payload_fn,
    effective_payload_signals_fn,
    clarifying_questions_for_payload_fn,
    bucket_legal_matches_fn,
    compatibility_facts_for_payload_fn,
    run_reason_core_fn,
    build_rule_catalog_fn,
) -> dict[str, Any]:
    """Run applicability pipeline and return chat-compatible assess envelope."""
    situation = spec_to_situation(spec, kg_facts)
    terms = terms_from_question(situation)
    legal, playbook = fetch_legal_playbook_fn(
        terms,
        playbook_company_id=playbook_company_id,
        account_id=account_id,
        account_playbook_id=account_playbook_id,
    )

    proposed = propose_scope_facts(
        situation,
        legal.get("matches") or [],
        playbook.get("matches") or [],
        case_id=case_id,
    )
    payload, selected_items, scenario_record = build_fact_payload_fn(
        situation=situation,
        proposed=proposed,
        clarification_answers={},
        selected_fact_ids=None,
    )
    effective_signals = effective_payload_signals_fn(payload)
    questions = clarifying_questions_for_payload_fn(payload)
    cites = bucket_legal_matches_fn(legal.get("matches") or [])
    compatibility_facts = compatibility_facts_for_payload_fn(
        case_id=payload.case_id,
        regulations=list(load_regulations()),
        personal_data_signal=effective_signals["personal_data"],
        eu_link_signal=effective_signals["eu_link"],
        active_phases=payload.active_phases,
    )
    core = run_reason_core_fn(
        terms,
        compatibility_facts,
        "scope_applicability",
        legal,
        playbook,
        scope_signals=effective_signals,
    )
    universal = run_universal_reasoner(
        payload.all_facts,
        case_id=payload.case_id,
        active_phases=payload.active_phases,
        signals=effective_signals,
    )
    flow_response = {
        **core.model_dump(),
        "situation": situation,
        "case_id": payload.case_id,
        "proposed_fact_items": selected_items,
        "graph_citations": cites,
        "extractor_notes": proposed.get("extractor_notes") or [],
        "scenario_record": scenario_record,
        "clarifying_questions": questions,
        "clarification_required": bool(questions),
        "fact_payload": payload.to_dict(),
        "universal": universal,
        "legal": legal,
        "playbook": playbook,
    }
    rule_catalog_resp = build_rule_catalog_fn()
    rule_catalog_list = [p.model_dump() for p in rule_catalog_resp.provisions]

    resp = build_chat_response(
        question=situation,
        flow_response=flow_response,
        rule_catalog=rule_catalog_list,
    )
    resp["mode"] = "applicability"
    from logic.corpus import corpus_status

    cs = corpus_status()
    resp["corpus_version"] = {
        "ready": cs.get("ready"),
        "build_stale": cs.get("stale"),
    }
    resp["selected_regulations"] = spec.get("regulations") or spec.get("selectedLaws") or list(
        load_regulations()
    )
    return resp
