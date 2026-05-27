"""
Phase C: multi-instrument scope evaluation with three-valued dimensions (PRD-style).

Works from the same normalized facts and engine outputs as ``scope_applicability``:
one evaluation per (case, regulation) pair in the Cartesian product of stated
``case`` and ``regulation`` atoms. Missing extensional facts yield
``cannot_determine`` for the relevant dimension (toy semantics; no explicit
negative atoms except ``exclusion_holds``).
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Literal

from logic.scope_contract import (
    FINAL_CONCLUSION_LABEL,
    build_scope_sections,
    normalize_skip_further,
)

DimStatus = Literal["pass", "fail", "cannot_determine"]
Verdict = Literal["applies", "does_not_apply", "cannot_determine"]

CITE_SCOPE = "rules/golden/scope_applicability.dl (toy orchestration)"


def _edb(facts: list[tuple[str, tuple[str, ...]]]) -> dict[str, set[tuple[str, ...]]]:
    edb: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    for pred, args in facts:
        edb[pred].add(args)
    return edb


def _instrument_slug(regulation: str) -> str:
    return regulation.strip().upper().replace(" ", "_").replace("-", "_")


def _pair_in_rows(rows: list[list[str]], c: str, r: str) -> bool:
    for row in rows:
        if len(row) >= 2 and row[0] == c and row[1] == r:
            return True
    return False


def _trace_row(
    dimension: str,
    predicate: str,
    result: DimStatus,
    citation: str,
    note: str,
) -> dict[str, str]:
    return {
        "dimension": dimension,
        "predicate": predicate,
        "result": result,
        "citation": citation,
        "note": note,
    }


def analyse_phase_c_scope(
    normalized: list[tuple[str, tuple[str, ...]]],
    outputs: dict[str, list[list[str]]],
    *,
    signals: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Build ``instrument_evaluations``, ``missing_facts``, and ``follow_up_questions``.

    ``outputs`` must contain relations from the scope engine (material_scope_ok,
    territorial_scope_ok, temporal_scope_ok, excluded, law_applies).
    """
    edb = _edb(normalized)
    cases = sorted({t[0] for t in edb["case"]})
    regulations = sorted({t[0] for t in edb["regulation"]})
    effective = {
        "personal_data": str((signals or {}).get("personal_data") or "unknown"),
        "eu_link": str((signals or {}).get("eu_link") or "unknown"),
        "ai_system": str((signals or {}).get("ai_system") or "unknown"),
    }

    evaluations: list[dict[str, Any]] = []
    missing_union: set[str] = set()
    follow_candidates: list[str] = []

    for c in cases:
        for r in regulations:
            has_temporal = (r,) in edb["law_in_force"]
            has_territorial = (c,) in edb["territorial_link_eu"] or effective["eu_link"] == "yes"
            excluded = (c, r) in edb["exclusion_holds"]

            if r == "gdpr":
                material_signal = effective["personal_data"]
                material_predicate = f"processing_personal_data({c})"
                missing_key = "processing_personal_data"
                material_pass = (c,) in edb["processing_personal_data"] or material_signal == "yes"
            elif r == "ai_act":
                material_signal = effective["ai_system"]
                material_predicate = f"ai_system_context({c})"
                missing_key = "ai_system_context"
                material_pass = material_signal == "yes"
            else:
                material_signal = effective["personal_data"]
                material_predicate = f"processing_personal_data({c})"
                missing_key = "processing_personal_data"
                material_pass = (c,) in edb["processing_personal_data"] or material_signal == "yes"

            tmp_st: DimStatus = "pass" if has_temporal else "fail"
            if effective["eu_link"] == "no":
                ter_st: DimStatus = "fail"
            elif has_territorial:
                ter_st = "pass"
            else:
                ter_st = "cannot_determine"
            if material_signal == "no":
                mat_st: DimStatus = "fail"
            elif material_pass:
                mat_st = "pass"
            else:
                mat_st = "cannot_determine"
            exc_st: DimStatus = "fail" if excluded else "pass"

            blocked_on: str | None = None
            skip_further: list[str] = []
            if tmp_st != "pass":
                verdict: Verdict = "does_not_apply"
                skip_further = ["territorial", "material", "exclusions"]
            elif ter_st == "cannot_determine":
                verdict = "cannot_determine"
                blocked_on = "territorial"
                skip_further = ["material", "exclusions"]
                missing_union.add("territorial_link_eu")
            elif ter_st != "pass":
                verdict = "does_not_apply"
                skip_further = ["material", "exclusions"]
            elif mat_st == "cannot_determine":
                verdict = "cannot_determine"
                blocked_on = "material"
                skip_further = ["exclusions"]
                missing_union.add(missing_key)
            elif mat_st != "pass":
                verdict = "does_not_apply"
            elif exc_st == "fail":
                verdict = "does_not_apply"
            else:
                verdict = "applies"

            conditional: list[str] = []
            if blocked_on == "territorial":
                conditional.append("Answer the EU-link clarification to continue the assessment.")
            if blocked_on == "material":
                conditional.append("Answer the material-scope clarification to continue the assessment.")

            trace: list[dict[str, str]] = [
                _trace_row(
                    "TEMPORAL",
                    f"law_in_force({r})",
                    tmp_st,
                    CITE_SCOPE,
                    "Temporal applicability is derived from active workbook phases."
                    if tmp_st == "pass"
                    else "No active workbook phase is currently in force for this regulation.",
                ),
                _trace_row(
                    "TERRITORIAL",
                    f"territorial_link_eu({c})",
                    ter_st,
                    CITE_SCOPE,
                    "Territorial link to the EU is unknown for this case."
                    if ter_st == "cannot_determine"
                    else "",
                ),
                _trace_row(
                    "MATERIAL",
                    material_predicate,
                    mat_st,
                    CITE_SCOPE,
                    "Material scope is unknown pending clarification."
                    if mat_st == "cannot_determine"
                    else "",
                ),
                _trace_row(
                    "EXCLUSION",
                    f"exclusion_holds({c}, {r})",
                    exc_st,
                    CITE_SCOPE,
                    "Exclusion fact present — scope negated for this pair."
                    if exc_st == "fail"
                    else "",
                ),
                _trace_row(
                    "overall",
                    f"law_applies({c}, {r})",
                    "pass"
                    if verdict == "applies"
                    else "cannot_determine"
                    if verdict == "cannot_determine"
                    else "fail",
                    CITE_SCOPE,
                    f"Verdict: {verdict}",
                ),
            ]

            scope_sections = build_scope_sections(
                statuses={
                    "temporal": tmp_st,
                    "territorial": ter_st,
                    "material": mat_st,
                    "exclusions": exc_st,
                },
                pair_data={
                    "temporal": {
                        "passed_pairs": [[c, r]] if tmp_st == "pass" else [],
                    },
                    "territorial": {
                        "passed_pairs": [[c, r]] if ter_st == "pass" else [],
                    },
                    "material": {
                        "passed_pairs": [[c, r]] if mat_st == "pass" else [],
                    },
                    "exclusions": {
                        "triggered_pairs": [[c, r]] if excluded else [],
                    },
                },
                skip_further=skip_further,
            )

            evaluations.append(
                {
                    "instrument_id": _instrument_slug(r),
                    "case_id": c,
                    "verdict": verdict,
                    "scope": {
                        "TEMPORAL": {
                            "status": tmp_st,
                            "passed_pairs": [[c, r]] if tmp_st == "pass" else [],
                            "triggered_pairs": [],
                        },
                        "TERRITORIAL": {
                            "status": ter_st,
                            "passed_pairs": [[c, r]] if ter_st == "pass" else [],
                            "triggered_pairs": [],
                        },
                        "MATERIAL": {
                            "status": mat_st,
                            "passed_pairs": [[c, r]] if mat_st == "pass" else [],
                            "triggered_pairs": [],
                        },
                        "EXCLUSION": {
                            "status": exc_st,
                            "passed_pairs": [],
                            "triggered_pairs": [[c, r]] if excluded else [],
                        },
                    },
                    "scope_sections": scope_sections,
                    "final_conclusion_label": FINAL_CONCLUSION_LABEL,
                    "dimensions_satisfied": {
                        "passing": sum(
                            1 for s in (tmp_st, ter_st, mat_st, exc_st) if s == "pass"
                        ),
                        "evaluated": 4 - len(skip_further),
                    },
                    "conditional_applies_if": conditional,
                    "trace": trace,
                    "data_tier": "tier1_symbolic",
                    "skip_further": normalize_skip_further(skip_further),
                    "blocked_on": blocked_on,
                }
            )

    prio = [
        (
            "processing_personal_data",
            "Does your situation involve processing data about identified or identifiable individuals?",
        ),
        (
            "territorial_link_eu",
            "Is your organisation established in the EU, or are you targeting EU-based individuals?",
        ),
        (
            "ai_system_context",
            "Does this situation involve an AI system using ML, statistical, or logic-based techniques?",
        ),
    ]
    for pred, qtext in prio:
        if pred in missing_union and len(follow_candidates) < 3:
            follow_candidates.append(qtext)

    return {
        "instrument_evaluations": evaluations,
        "missing_facts": sorted(missing_union),
        "follow_up_questions": follow_candidates,
    }
