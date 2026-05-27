"""
POST /api/chat adapter.

Converts the local applicability-flow + universal-reasoner output into
the ComplianceTwin { narrative, symbolic } envelope that the React UI
expects.  The symbolic engine (Soufflé + corpus rules) is authoritative;
the narrative wrapper only explains what the engine derived.
"""

from __future__ import annotations

import re
import textwrap
from typing import Any

from logic.display_tokens import format_fact_value
from logic.playbook_store import company_by_id, filter_playbook_terms, rank_playbook_for_display

# ── verdict mapping ────────────────────────────────────────────────────────
_VERDICT_MAP = {
    "in_scope": "applies",
    "excluded": "does_not_apply",
    "out_of_scope": "does_not_apply",
    "needs_clarification": "cannot_determine",
}


def _ct_verdict(local: str) -> str:
    return _VERDICT_MAP.get(local, "cannot_determine")


# ── scope dimension → trace result ───────────────────────────────────────
def _dim_result(status: str) -> str:
    if status == "pass":
        return "pass"
    if status == "fail":
        return "fail"
    if status == "skipped":
        return "not_reached"
    return "cannot_determine"


# ── build trace entries from scope_sections ───────────────────────────────
def _build_trace(
    reg: str,
    eval_row: dict[str, Any],
    citations_by_dim: dict[str, list[str]],
) -> list[dict[str, Any]]:
    trace: list[dict[str, Any]] = []
    dim_statuses: dict[str, str] = eval_row.get("dimension_statuses") or {}
    scope_sections: list[dict[str, Any]] = eval_row.get("scope_sections") or []

    _DIM_PLIDS: dict[str, dict[str, str]] = {
        "gdpr": {
            "temporal": "GDPR_A99",
            "territorial": "GDPR_A3",
            "material": "GDPR_A4.1",
            "exclusions": "GDPR_A2.2",
        },
        "ai_act": {
            "temporal": "AIAct_A113",
            "territorial": "AIAct_A2.1",
            "material": "AIAct_A3.1",
            "exclusions": "AIAct_A2.3",
        },
    }
    dim_plids = _DIM_PLIDS.get(reg.lower(), {})

    for sec in scope_sections:
        sec_id = (sec.get("id") or "").lower()
        if sec_id not in ("temporal", "territorial", "material", "exclusions"):
            continue
        status = dim_statuses.get(sec_id, "cannot_determine")
        result = _dim_result(status)
        label = sec.get("label") or sec_id
        evidence = _evidence_for(reg, sec_id, eval_row, status)
        cites: list[str] = []
        primary = dim_plids.get(sec_id)
        if primary:
            cites.append(primary)
        trace.append(
            {
                "dimension": sec_id if sec_id != "exclusions" else "exclusion",
                "predicate": f"{sec_id}_scope_test",
                "result": result,
                "evidence": evidence,
                "citations": cites[:4],
                "note": label,
            }
        )

    # overall
    verdict = eval_row.get("verdict", "needs_clarification")
    trace.append(
        {
            "dimension": "overall",
            "result": _dim_result("pass") if verdict == "in_scope" else (
                "deferred" if verdict == "deferred" else (
                    "fail" if verdict in ("out_of_scope", "excluded") else "cannot_determine"
                )
            ),
            "evidence": eval_row.get("headline") or "",
            "citations": [],
        }
    )
    return trace


def _evidence_for(
    reg: str,
    dim: str,
    eval_row: dict[str, Any],
    status: str,
) -> str:
    derived = eval_row.get("derived") or {}
    headline = eval_row.get("headline") or ""

    if dim == "temporal":
        phases = derived.get("active_phases") or []
        if phases:
            return f"Regulation {reg.upper()} is in force (active phases: {', '.join(phases)})."
        if status == "pass":
            return f"{reg.upper()} is in force at the relevant date."
        return f"{reg.upper()} is not yet in force for this scenario — provide a deployment / market-entry date."

    if dim == "territorial":
        links = eval_row.get("territorial_links") or []
        actors = eval_row.get("actors") or []
        if status == "pass":
            actor_str = f" (via {', '.join(actors)})" if actors else ""
            return f"EU territorial connection established{actor_str}."
        if status == "cannot_determine":
            return "No EU territorial connection confirmed yet — provide establishment, market, or subject location."
        return "No EU connection established on the facts provided."

    if dim == "material":
        if status == "pass":
            if reg.lower() == "gdpr":
                return "Processing of personal data confirmed (Art. 4(1))."
            return "AI system confirmed within meaning of Art. 3(1)."
        if status == "cannot_determine":
            if reg.lower() == "gdpr":
                return "Processing of personal data not yet confirmed — clarification needed."
            return "AI system classification not yet confirmed — clarification needed."
        return "Subject-matter does not fall within the regulation's material scope."

    if dim == "exclusions":
        excl = derived.get("excluded", False)
        if excl:
            return f"An exclusion is triggered for {reg.upper()} on these facts."
        return f"No exclusion applies for {reg.upper()} on these facts."

    return headline


# ── risk classification ───────────────────────────────────────────────────
def _risk_category(eval_row: dict[str, Any]) -> str | None:
    if eval_row.get("regulation", "").lower() != "ai_act":
        return None
    derived = eval_row.get("derived") or {}
    if derived.get("high_risk_ai"):
        return "high_risk_annex_III"
    return None


# ── regulation display names ──────────────────────────────────────────────
_REG_NAMES = {
    "gdpr": "GDPR",
    "ai_act": "EU_AI_ACT",
}


def _iid(reg: str) -> str:
    return _REG_NAMES.get(reg.lower(), reg.upper())


# ── citations from corpus provenance ─────────────────────────────────────
def _citations_by_dim_from_provenance(
    reg: str,
    provenance: dict[str, Any],
    rule_catalog: list[dict[str, Any]],
) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {
        "temporal": [],
        "territorial": [],
        "material": [],
        "exclusions": [],
    }
    groups = (provenance.get("groups") or [])
    reg_upper = reg.upper()
    for g in groups:
        for entry in (g.get("entries") or []):
            if str(entry.get("regulation") or "").upper() != reg_upper:
                continue
            dim_raw = str(entry.get("dimension") or "").lower()
            dim = dim_raw if dim_raw in out else None
            if not dim:
                continue
            for cite in entry.get("citations") or []:
                c = str(cite).strip()
                if c and c not in out[dim]:
                    out[dim].append(c)

    return out


# ── narrative helpers ─────────────────────────────────────────────────────
def _build_narrative(
    question: str,
    applicability_results: dict[str, Any],
    clarification_required: bool,
    clarifying_questions: list[dict[str, Any]],
) -> dict[str, Any]:
    session_title = textwrap.shorten(question, width=42, placeholder="…")

    bottom_line = _build_bottom_line(applicability_results, clarification_required)

    if clarification_required:
        bullets = []
        for iid, res in applicability_results.items():
            v = res.get("verdict", "cannot_determine")
            signal = (
                "likely in scope"
                if v == "applies"
                else ("likely no" if v == "does_not_apply" else "more information needed")
            )
            reason = res.get("headline") or ""
            bullets.append({"instrument_id": iid, "signal": signal, "reason": reason[:120]})

        focused_qs = [q.get("text") for q in (clarifying_questions or []) if q.get("text")]
        return {
            "verdict_type": "gathering",
            "verdict_line": "More information is needed before the regulation scope can be determined.",
            "indicative_bullets": bullets,
            "focused_questions": focused_qs,
            "session_title": session_title,
            "bottom_line": bottom_line,
        }

    # All regs have determinate verdicts
    fires = [iid for iid, r in applicability_results.items() if r.get("verdict") == "applies"]
    blocked = [iid for iid, r in applicability_results.items() if r.get("verdict") == "does_not_apply"]
    regs_str = " and ".join(fires) if fires else "No regulation"
    verdict_line = (
        f"{regs_str} {'applies' if len(fires) == 1 else 'apply'} on the facts provided."
        if fires
        else "On the facts provided, the assessed regulations do not appear to apply."
    )

    return {
        "verdict_type": "applies" if fires else ("does_not_apply" if blocked else "cannot_determine"),
        "verdict_line": verdict_line,
        "full_analysis": "",
        "session_title": session_title,
        "bottom_line": bottom_line,
    }


def _trace_evidence_summary(res: dict[str, Any]) -> str:
    trace = res.get("trace") or []
    evidences: list[str] = []
    citations: list[str] = []
    for t in trace:
        ev = t.get("evidence") or ""
        if ev and len(ev) < 220:
            evidences.append(ev)
        for c in (t.get("citations") or [])[:3]:
            c = str(c).strip()
            if c and c not in citations:
                citations.append(c)
        if len(evidences) >= 3:
            break
    evidences_txt = " ".join(evidences[:3]).strip()
    if citations:
        return f"{evidences_txt} (citations: {', '.join(citations[:6])}).".strip()
    return evidences_txt or ""


def _conclusion_for_instrument(iid: str, res: dict[str, Any]) -> str:
    verdict = res.get("verdict")
    trace_summary = _trace_evidence_summary(res)
    headline = res.get("headline") or ""
    missing = res.get("missing_atoms") or []

    if verdict == "in_scope" or verdict == "applies":
        if trace_summary:
            return f"{iid} applies based on the scope gates satisfied in the symbolic trace. {trace_summary}"
        return headline or f"{iid} applies on the facts provided."

    if verdict == "does_not_apply":
        if trace_summary:
            return f"{iid} does not apply because one or more scope gates failed in the symbolic trace. {trace_summary}"
        return headline or f"{iid} does not apply on the facts provided."

    # cannot_determine
    if missing:
        missing_txt = ", ".join(str(m) for m in missing[:6] if str(m).strip())
        return (
            f"{iid} applies cannot be concluded yet: key scope dimensions are open in the symbolic trace. "
            f"Missing/uncertain facts: {missing_txt}. {trace_summary}".strip()
        )
    if trace_summary:
        return f"{iid} cannot be concluded yet because scope dimensions are open in the symbolic trace. {trace_summary}"
    return headline or f"{iid} cannot be concluded yet on the facts provided."


def _ai_high_risk_row(applicability_results: dict[str, Any]) -> dict[str, Any] | None:
    ai = applicability_results.get("EU_AI_ACT")
    if not ai:
        return None
    verdict = ai.get("verdict")
    risk_category = ai.get("risk_category") or None
    if verdict == "applies":
        if risk_category:
            result = "HIGH-RISK CONFIRMED"
            conclusion = f"The AI Act is within scope, and the symbolic trace confirms a high-risk classification: {risk_category}."
        else:
            result = "HIGH-RISK UNKNOWN"
            missing = (ai.get("missing_atoms") or [])[:4]
            if missing:
                conclusion = (
                    "The AI Act is within scope, but the symbolic trace does not confirm the high-risk category. "
                    f"Missing facts: {', '.join(missing)}."
                )
            else:
                conclusion = (
                    "The AI Act is within scope, but the symbolic trace does not confirm the high-risk category on the facts provided."
                )
    else:
        result = "HIGH-RISK N/A"
        conclusion = "High-risk classification is not applicable until the AI Act scope verdict is satisfied."

    return {"instrument": "AI Act high-risk status", "result": result, "conclusion_text": conclusion}


def _build_bottom_line(
    applicability_results: dict[str, Any],
    clarification_required: bool,
) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for iid, res in applicability_results.items():
        verdict = res.get("verdict")
        if verdict == "applies":
            result = "APPLIES"
        elif verdict == "does_not_apply" or verdict == "excluded":
            result = "DOES NOT APPLY"
        else:
            result = "UNKNOWN"

        conclusion = _conclusion_for_instrument(iid, res)
        rows.append(
            {
                "instrument": iid,
                "result": result,
                "conclusion_text": conclusion,
            }
        )

    # AI Act high-risk row (if we assessed AI Act)
    ai_row = _ai_high_risk_row(applicability_results)
    if ai_row:
        rows.append(ai_row)

    any_applies = any(r.get("result") == "APPLIES" for r in rows)
    ai_high_risk = next((r for r in rows if r.get("instrument") == "AI Act high-risk status"), None)
    ai_unknown = ai_high_risk and ai_high_risk.get("result") == "HIGH-RISK UNKNOWN"

    if any_applies and ai_unknown:
        title = "BOTTOM LINE — APPLIES, BUT HIGH-RISK UNKNOWN"
    elif any_applies:
        title = "BOTTOM LINE — APPLIES"
    else:
        title = "BOTTOM LINE — DOES NOT APPLY / OPEN"

    if clarification_required and not any_applies:
        title = "BOTTOM LINE — OPEN (NEEDS CLARIFICATION)"

    return {"title": title, "rows": rows}


def _worksheet_result_from_trace_result(trace_result: str) -> str:
    mapping = {
        "pass": "PASS",
        "fail": "FAIL",
        "not_reached": "NOT_REACHED",
        "cannot_determine": "UNKNOWN",
        "deferred": "DEFERRED",
    }
    return mapping.get(str(trace_result), "UNKNOWN")


def _build_worksheet(applicability_results: dict[str, Any]) -> dict[str, Any]:
    """
    Normalized worksheet row model for the frontend.

    Each row represents a legal test (e.g., temporal/territorial/material gate),
    and includes per-instrument results plus wordy reasoning + citations.
    """
    gdpr_iid = "GDPR"
    ai_iid = "EU_AI_ACT"

    row_index: dict[str, dict[str, Any]] = {}

    for iid, res in applicability_results.items():
        trace = res.get("trace") or []
        for t in trace:
            dim = str(t.get("dimension") or "")
            if not dim or dim == "overall":
                continue

            note = str(t.get("note") or "").strip()
            predicate = str(t.get("predicate") or "").strip()
            legal_test_name = note or predicate or dim
            key = f"{dim}::{legal_test_name}"

            row = row_index.get(key)
            if not row:
                row = {
                    "legal_test_name": legal_test_name,
                    "gdpr_result": None,
                    "ai_act_result": None,
                    "reasoning": "",
                    "legal_basis": "",
                    "_gdpr_reasoning": "",
                    "_gdpr_basis": [],
                    "_ai_reasoning": "",
                    "_ai_basis": [],
                }
                row_index[key] = row

            tr = t.get("result")
            verdict = _worksheet_result_from_trace_result(str(tr))
            evidence = str(t.get("evidence") or "").strip()
            citations = [str(c).strip() for c in (t.get("citations") or []) if str(c).strip()]

            if iid == gdpr_iid:
                row["gdpr_result"] = verdict
                if evidence and not row["_gdpr_reasoning"]:
                    row["_gdpr_reasoning"] = evidence
                for c in citations:
                    if c not in row["_gdpr_basis"]:
                        row["_gdpr_basis"].append(c)
            elif iid == ai_iid:
                row["ai_act_result"] = verdict
                if evidence and not row["_ai_reasoning"]:
                    row["_ai_reasoning"] = evidence
                for c in citations:
                    if c not in row["_ai_basis"]:
                        row["_ai_basis"].append(c)

    rows: list[dict[str, Any]] = []
    for _, row in row_index.items():
        gdpr_reasoning = row.get("_gdpr_reasoning") or ""
        ai_reasoning = row.get("_ai_reasoning") or ""
        gdpr_basis = row.get("_gdpr_basis") or []
        ai_basis = row.get("_ai_basis") or []

        # Prefer the more specific/complete evidence.
        reasoning = gdpr_reasoning or ai_reasoning
        if gdpr_reasoning and ai_reasoning and len(ai_reasoning) > len(gdpr_reasoning):
            reasoning = ai_reasoning

        legal_basis = ", ".join((gdpr_basis or ai_basis)[:10])

        rows.append(
            {
                "legal_test_name": row.get("legal_test_name"),
                "gdpr_result": row.get("gdpr_result") or "UNKNOWN",
                "ai_act_result": row.get("ai_act_result") or "UNKNOWN",
                "reasoning": reasoning,
                "legal_basis": legal_basis,
            }
        )

    # Deterministic order.
    ordered = sorted(rows, key=lambda r: r.get("legal_test_name") or "")
    return {"rows": ordered}


# ── playbook fact enrichment ──────────────────────────────────────────────
def _enrich_with_playbook(
    consolidated_facts: list[dict[str, Any]],
    playbook_matches: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Annotate facts that have a matching Neo4j playbook node."""
    pb_ids = {str(m.get("id") or "") for m in playbook_matches if m.get("id")}
    pb_labels = {
        str(m.get("id") or ""): (
            (m.get("properties") or {}).get("name")
            or (m.get("properties") or {}).get("title")
            or str(m.get("id") or "")
        )
        for m in playbook_matches
    }
    for f in consolidated_facts:
        src_id = str(f.get("playbook_node_id") or "")
        if src_id and src_id in pb_ids:
            f["playbook_label"] = pb_labels.get(src_id, src_id)
            f["source_tag"] = "playbook"
    return consolidated_facts


def _field_label(predicate: str) -> str:
    pred = str(predicate or "").strip()
    if not pred:
        return "Fact"
    return pred.replace("_", " ").strip().title()


def _question_source_tag(raw: str) -> str:
    """Normalize engine fact sources for the UI."""
    tag = (raw or "").strip().lower()
    if tag in ("rules", "llm", "scenario", "extracted", "clarified", "derived"):
        return "question"
    return "question"


def _collect_missing_atoms(applicability_results: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for res in applicability_results.values():
        for atom in res.get("missing_atoms") or []:
            a = str(atom).strip()
            if a and a not in out:
                out.append(a)
    return out


def _build_facts_table(
    consolidated: list[dict[str, Any]],
    playbook_matches: list[dict[str, Any]],
    *,
    playbook_company_id: str | None,
    question: str = "",
    applicability_results: dict[str, Any] | None = None,
    case_id: str | None = None,
) -> dict[str, Any]:
    question_rows: list[dict[str, Any]] = []
    for f in consolidated:
        if str(f.get("source_tag") or "") == "playbook":
            continue
        pred = str(f.get("predicate") or "")
        args = f.get("args") or []
        value = format_fact_value(pred, args, case_id=case_id)
        question_rows.append(
            {
                "field": _field_label(pred),
                "value": value,
                "source": _question_source_tag(str(f.get("source_tag") or "scenario")),
                "predicate": pred,
            }
        )

    company_id = (playbook_company_id or "").strip() or None
    playbook_primary: list[dict[str, Any]] = []
    playbook_extended: list[dict[str, Any]] = []
    co_label: str | None = None

    if company_id:
        missing = _collect_missing_atoms(applicability_results or {})
        q_terms = filter_playbook_terms(re.findall(r"[a-zA-Z0-9]{2,}", (question or "").lower()))
        playbook_primary, playbook_extended = rank_playbook_for_display(
            playbook_matches,
            company_id=company_id,
            terms=q_terms,
            question=question,
            missing_atoms=missing,
        )
        co = company_by_id(company_id)
        co_label = co["label"] if co else company_id

    rows = question_rows + playbook_primary
    title = (
        "Facts from the question and playbook"
        if company_id
        else "Facts from your question"
    )
    return {
        "title": title,
        "rows": rows,
        "from_question": question_rows,
        "from_playbook": playbook_primary,
        "playbook_extended": playbook_extended,
        "question_count": len(question_rows),
        "playbook_count": len(playbook_primary),
        "playbook_total_matched": len(playbook_primary) + len(playbook_extended),
        "playbook_company_id": company_id,
        "playbook_company_label": co_label,
    }


def _build_assessment(
    *,
    narrative: dict[str, Any],
    facts_table: dict[str, Any],
    worksheet: dict[str, Any],
    scope_analysis: dict[str, Any],
    clarifying_questions: list[dict[str, Any]],
    playbook: dict[str, Any],
    applicability_results: dict[str, Any],
    question: str = "",
) -> dict[str, Any]:
    """Unified assessment envelope for the sticky panel."""
    from logic.facts_summarizer import summarize_facts_for_display

    extended = facts_table.get("playbook_extended") or []
    facts_summary = summarize_facts_for_display(
        question=question,
        from_question=facts_table.get("from_question") or [],
        from_playbook=facts_table.get("from_playbook") or [],
        playbook_company_label=str(facts_table.get("playbook_company_label") or ""),
        playbook_extended_count=len(extended),
    )
    facts_block: dict[str, Any] = {
        "from_question": facts_table.get("from_question") or [],
        "from_playbook": facts_table.get("from_playbook") or [],
        "playbook_extended": extended,
        "playbook_total_matched": facts_table.get("playbook_total_matched", 0),
        "playbook_company_id": facts_table.get("playbook_company_id"),
        "playbook_company_label": facts_table.get("playbook_company_label"),
    }
    if facts_summary:
        facts_block["summary"] = facts_summary

    return {
        "conclusion": {
            "bottom_line": narrative.get("bottom_line") or {
                "title": narrative.get("verdict_line", ""),
                "rows": [],
            },
            "verdict_type": narrative.get("verdict_type"),
            "verdict_line": narrative.get("verdict_line"),
            "focused_questions": narrative.get("focused_questions") or [],
        },
        "facts": facts_block,
        "scope": worksheet,
        "scope_analysis": scope_analysis,
        "open_questions": clarifying_questions,
        "playbook": {
            "company_id": playbook.get("company_id"),
            "company_label": facts_table.get("playbook_company_label"),
            "error": playbook.get("error"),
            "match_count": playbook.get("match_count", 0),
        },
        "applicability_results": applicability_results,
    }


# ── main entry point ──────────────────────────────────────────────────────
def build_chat_response(
    *,
    question: str,
    flow_response: dict[str, Any],
    rule_catalog: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Build the ComplianceTwin { narrative, symbolic } envelope from the
    local applicability-flow output.

    flow_response  -- result of /api/applicability-flow (dict)
    rule_catalog   -- list of provision dicts from /api/rule-catalog
    """
    universal: dict[str, Any] = flow_response.get("universal") or {}
    evaluations: list[dict[str, Any]] = universal.get("evaluations") or []
    provenance: dict[str, Any] = universal.get("provenance") or {}
    fact_payload: dict[str, Any] = flow_response.get("fact_payload") or {}
    clarification_required: bool = bool(flow_response.get("clarification_required"))
    clarifying_questions: list[dict[str, Any]] = flow_response.get("clarifying_questions") or []
    playbook: dict[str, Any] = flow_response.get("playbook") or {}
    playbook_matches: list[dict[str, Any]] = playbook.get("matches") or []
    graph_citations: dict[str, Any] = flow_response.get("graph_citations") or {}

    # Per-regulation results
    applicability_results: dict[str, Any] = {}
    for ev in evaluations:
        reg = str(ev.get("regulation") or "").strip()
        if not reg:
            continue
        iid = _iid(reg)
        ct_verdict = _ct_verdict(ev.get("verdict", "needs_clarification"))
        cit_by_dim = _citations_by_dim_from_provenance(reg, provenance, rule_catalog)
        trace = _build_trace(reg, ev, cit_by_dim)
        scope = {
            "temporal": _dim_result(
                (ev.get("dimension_statuses") or {}).get("temporal", "cannot_determine")
            ),
            "territorial": _dim_result(
                (ev.get("dimension_statuses") or {}).get("territorial", "cannot_determine")
            ),
            "material": _dim_result(
                (ev.get("dimension_statuses") or {}).get("material", "cannot_determine")
            ),
            "exclusions": _dim_result(
                (ev.get("dimension_statuses") or {}).get("exclusions", "pass")
            ),
        }
        applicability_results[iid] = {
            "verdict": ct_verdict,
            "scope": scope,
            "trace": trace,
            "risk_category": _risk_category(ev),
            "headline": ev.get("headline") or "",
            "missing_atoms": ev.get("missing_atoms") or [],
            "actors": ev.get("actors") or [],
            "playbook_error": playbook.get("error"),
        }

    narrative = _build_narrative(
        question=question,
        applicability_results=applicability_results,
        clarification_required=clarification_required,
        clarifying_questions=clarifying_questions,
    )

    worksheet = _build_worksheet(applicability_results)

    from logic.scope_analysis import build_scope_analysis
    from logic.scope_summarizer import merge_scope_llm, summarize_scope_analysis

    # Consolidated facts for the "Facts on the record" panel
    all_facts: list[dict[str, Any]] = fact_payload.get("all_facts") or []
    consolidated: list[dict[str, Any]] = []
    for f in all_facts:
        pred = str(f.get("predicate") or "")
        args = f.get("args") or []
        consolidated.append(
            {
                "predicate": pred,
                "args": args,
                "status": str(f.get("status") or "extracted"),
                "source_tag": str(f.get("source") or "scenario"),
            }
        )
    consolidated = _enrich_with_playbook(consolidated, playbook_matches)

    facts_table = _build_facts_table(
        consolidated,
        playbook_matches,
        playbook_company_id=playbook.get("company_id"),
        question=question,
        applicability_results=applicability_results,
        case_id=str(flow_response.get("case_id") or "") or None,
    )

    scope_analysis = build_scope_analysis(
        applicability_results=applicability_results,
        provenance=provenance,
        rule_catalog=rule_catalog,
        question_facts=facts_table.get("from_question") or [],
        case_id=str(flow_response.get("case_id") or "") or None,
    )
    scope_llm = summarize_scope_analysis(scope_analysis)
    scope_analysis = merge_scope_llm(scope_analysis, scope_llm)

    assessment = _build_assessment(
        narrative=narrative,
        facts_table=facts_table,
        worksheet=worksheet,
        scope_analysis=scope_analysis,
        clarifying_questions=clarifying_questions,
        playbook=playbook,
        applicability_results=applicability_results,
        question=question,
    )

    return {
        "mode": "applicability",
        "assessment": assessment,
        "narrative": narrative,
        "worksheet": worksheet,
        "scope_analysis": scope_analysis,
        "symbolic": {
            "applicability_results": applicability_results,
            "context": {
                "product_name": None,
                "session_id": flow_response.get("case_id"),
            },
        },
        "fact_payload": fact_payload,
        "consolidated_facts": consolidated,
        "facts_table": facts_table,
        "clarifying_questions": clarifying_questions,
        "clarification_required": clarification_required,
        "graph_citations": graph_citations,
        "playbook": {
            "matches": playbook_matches,
            "error": playbook.get("error"),
            "match_count": playbook.get("match_count", 0),
            "company_id": playbook.get("company_id"),
            "company_label": facts_table.get("playbook_company_label"),
        },
        "extractor_notes": flow_response.get("extractor_notes") or [],
    }
