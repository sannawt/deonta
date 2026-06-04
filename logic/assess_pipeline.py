"""
Structured product assessment pipeline (no chat UI dependency).
"""

from __future__ import annotations

from typing import Any, Optional

from logic.chat_adapter import build_chat_response
from logic.fact_extractor import propose_scope_facts
from logic.predicate_facts import (
    clarifying_questions_from_missing,
    merge_scenario_facts,
    missing_predicates_for_regulations,
)
from logic.reasoner import run_universal_reasoner
from logic.corpus import load_regulations
from logic.terms import terms_from_question

# Imported from main at runtime to avoid circular imports — callers pass helpers.


def spec_to_situation(spec: dict[str, Any], kg_facts: list[dict[str, Any]] | None = None) -> str:
    name = (spec.get("name") or "").strip() or "Unknown product"
    summary = (spec.get("summary") or "").strip() or "No description provided."
    markets = spec.get("markets") or []
    if isinstance(markets, list):
        markets_s = ", ".join(str(m) for m in markets) if markets else "not specified"
    else:
        markets_s = str(markets) if markets else "not specified"

    lines = [
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
        lines.append("Extracted predicate facts:")
        for f in kg_facts[:40]:
            pred = f.get("predicate") or f.get("label") or "fact"
            args = f.get("args")
            if args:
                val = f"{pred}({', '.join(str(a) for a in args)})"
            else:
                val = f.get("value") or f.get("text") or ""
            prov = f.get("provenance") or f.get("source") or ""
            suffix = f" [{prov}]" if prov else ""
            lines.append(f"- {val}{suffix}")
    regs = spec.get("regulations") or spec.get("selectedLaws")
    if regs and isinstance(regs, list):
        lines.append("")
        lines.append(f"Focus regulations: {', '.join(str(r) for r in regs)}")
    return "\n".join(lines)


def _normalize_regulation_codes(codes: list[str] | None) -> list[str]:
    if not codes:
        return list(load_regulations())
    known = set(load_regulations())
    out: list[str] = []
    for raw in codes:
        code = str(raw).strip().lower().replace("-", "_")
        if code in known and code not in out:
            out.append(code)
    return out or list(load_regulations())


def _kg_facts_to_predicate_atoms(kg_facts: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    atoms: list[dict[str, Any]] = []
    for f in kg_facts or []:
        pred = str(f.get("predicate") or "").strip()
        args = f.get("args")
        if pred and isinstance(args, list) and args:
            atoms.append(
                {
                    "predicate": pred,
                    "args": [str(x) for x in args],
                    "source": f.get("source") or f.get("provenance") or "kg",
                    "status": "derived",
                }
            )
    return atoms


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
    selected_regs = _normalize_regulation_codes(
        spec.get("regulations") or spec.get("selectedLaws")
    )
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
    kg_atoms = _kg_facts_to_predicate_atoms(kg_facts)
    if kg_atoms:
        merged_extracted = merge_scenario_facts(
            [{"predicate": i["predicate"], "args": i["args"], "source": i.get("source", "kg"), "status": "derived"} for i in kg_atoms],
            proposed.get("facts") or [],
        )
        proposed = {**proposed, "facts": merged_extracted}
        items = list(proposed.get("proposed_fact_items") or [])
        base_id = len(items) + 1
        for idx, atom in enumerate(merged_extracted):
            if any(
                item.get("predicate") == atom["predicate"] and item.get("args") == atom["args"]
                for item in items
            ):
                continue
            items.append(
                {
                    "id": base_id + idx,
                    "predicate": atom["predicate"],
                    "args": atom["args"],
                    "label": f"{atom['predicate']}({', '.join(atom['args'])})",
                    "selected": True,
                    "source": atom.get("source", "kg"),
                }
            )
        proposed["proposed_fact_items"] = items

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
        regulations=selected_regs,
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
    if selected_regs and universal.get("evaluations"):
        sel = set(selected_regs)
        universal = {
            **universal,
            "evaluations": [
                ev for ev in universal["evaluations"] if ev.get("regulation") in sel
            ],
        }
    missing = missing_predicates_for_regulations(selected_regs, payload.all_facts)
    extra_questions = clarifying_questions_from_missing(missing)
    seen_q = {q.get("id") for q in questions}
    for q in extra_questions:
        if q.get("id") not in seen_q:
            questions.append(q)
            seen_q.add(q.get("id"))

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
        "missing_predicates": missing,
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
    resp["selected_regulations"] = selected_regs
    resp["missing_predicates"] = missing
    return resp
