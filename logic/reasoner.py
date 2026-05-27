from __future__ import annotations

from typing import Any

from logic.corpus import ensure_corpus_ready, load_output_predicates, load_regulations
from logic.defeasibility import build_defeasibility
from logic.fact_payload import infer_scenario_id
from logic.provenance import build_provenance
from logic.schema import validate_ground_facts
from logic.scope_contract import (
    FINAL_CONCLUSION_LABEL,
    build_scope_sections,
    normalize_skip_further,
)
from logic.souffle_runner import run_corpus_program, souffle_available


def _rows_for_relation(outputs: dict[str, list[list[str]]], name: str) -> list[list[str]]:
    return outputs.get(name) or []


def _status_from_signal(signal: str, grounded: bool) -> str:
    if signal == "yes":
        return "pass"
    if signal == "no":
        return "fail"
    return "pass" if grounded else "cannot_determine"


def _missing_atoms_for(reg: str, blocked_on: str, scenario_id: str | None) -> list[str]:
    if not scenario_id:
        return []
    if blocked_on == "territorial":
        if reg == "gdpr":
            return [
                f'processing_in_context_of_establishment("{scenario_id}", "your_org")',
                f'data_subjects_in_eu_targeted("{scenario_id}", "your_org")',
            ]
        return [
            f'places_on_eu_market("your_org", "{scenario_id}")',
            f'output_used_in_eu("{scenario_id}")',
        ]
    if blocked_on == "material":
        if reg == "gdpr":
            datum_id = f"{scenario_id}_datum"
            person_id = f"{scenario_id}_person"
            return [
                f'processing_concerns("{scenario_id}", "{datum_id}")',
                f'natural_person("{person_id}")',
                f'identifies("{datum_id}", "{person_id}")',
            ]
        return [
            f'has_feature("{scenario_id}", "machine_based")',
            f'has_capability("{scenario_id}", "autonomous_operation")',
            f'has_capability("{scenario_id}", "inference_from_input")',
        ]
    return []


def _headline(reg: str, verdict: str, reason: str | None, blocked_on: str | None) -> str:
    reg_name = reg.upper()
    if verdict == "in_scope":
        return f"On the facts provided, {reg_name} would appear to apply."
    if verdict == "excluded":
        return f"On the facts provided, {reg_name} would otherwise be in scope but an exclusion appears to apply."
    if verdict == "needs_clarification":
        dim = (blocked_on or "scope").replace("_", " ")
        return f"Before assessing {reg_name}, more information is needed about {dim}."
    basis = (reason or "scope").replace("_", " ")
    return f"On the facts provided, {reg_name} would appear to be out of scope due to {basis}."


def _evaluate_regulations(
    regulations: list[str],
    outputs: dict[str, list[list[str]]],
    scenario_id: str | None,
    *,
    active_phases: dict[str, list[str]] | None = None,
    signals: dict[str, str] | None = None,
    normalized_facts: list[tuple[str, tuple[str, ...]]] | None = None,
) -> list[dict[str, Any]]:
    evaluations: list[dict[str, Any]] = []
    applies_rows = _rows_for_relation(outputs, "applies")
    via_actor_rows = _rows_for_relation(outputs, "applies_via_actor")
    mat_rows = _rows_for_relation(outputs, "regulation_material")
    terr_rows = _rows_for_relation(outputs, "regulation_territorial_link")
    exc_rows = _rows_for_relation(outputs, "regulation_excluded")
    high_risk_rows = _rows_for_relation(outputs, "high_risk_ai")

    def has(rows: list[list[str]], prefix: list[str]) -> bool:
        for row in rows:
            if row[: len(prefix)] == prefix:
                return True
        return False

    for reg in regulations:
        phases = list((active_phases or {}).get(reg) or [])
        temporal_status = "pass" if phases else "fail"
        terr_actor_rows = (
            [
                row
                for row in terr_rows
                if len(row) >= 3 and row[0] == reg and row[2] == scenario_id
            ]
            if scenario_id
            else []
        )
        mat_grounded = has(mat_rows, [reg, scenario_id]) if scenario_id else False
        terr_grounded = bool(terr_actor_rows)
        excluded = has(exc_rows, [reg, scenario_id]) if scenario_id else False
        material_status = _status_from_signal(
            (signals or {}).get("personal_data" if reg == "gdpr" else "ai_system", "unknown"),
            mat_grounded,
        )
        territorial_status = _status_from_signal(
            (signals or {}).get("eu_link", "unknown"),
            terr_grounded,
        )
        high_risk = (
            any(len(row) >= 1 and row[0] == scenario_id for row in high_risk_rows)
            if scenario_id
            else False
        )
        if not high_risk and scenario_id and normalized_facts:
            high_risk = any(
                pred == "high_risk_ai_use_case" and args and args[0] == scenario_id
                for pred, args in normalized_facts
            )
        applies_from_corpus = (
            any(
            len(row) >= 3 and row[0] == scenario_id and row[2] == reg for row in applies_rows
        ) if scenario_id else False
        )
        applies_via = (
            [
                row
                for row in via_actor_rows
                if len(row) >= 4 and row[0] == scenario_id and row[2] == reg
            ]
            if scenario_id
            else []
        )

        verdict = "in_scope"
        reason: str | None = None
        blocked_on: str | None = None
        skip_further: list[str] = []
        if temporal_status != "pass":
            verdict = "out_of_scope"
            reason = "temporal"
            skip_further = ["territorial", "material", "exclusions"]
        elif territorial_status == "cannot_determine":
            verdict = "needs_clarification"
            blocked_on = "territorial"
            skip_further = ["material", "exclusions"]
        elif territorial_status != "pass":
            verdict = "out_of_scope"
            reason = "territorial"
            skip_further = ["material", "exclusions"]
        elif material_status == "cannot_determine":
            verdict = "needs_clarification"
            blocked_on = "material"
            skip_further = ["exclusions"]
        elif material_status != "pass":
            verdict = "out_of_scope"
            reason = "material"
        elif excluded:
            verdict = "excluded"
            reason = "exclusion"
        applies = verdict == "in_scope"
        if verdict == "in_scope":
            indication = "yes"
        elif verdict == "needs_clarification":
            indication = "partial"
        else:
            indication = "no"
        missing_atoms = _missing_atoms_for(reg, blocked_on or "", scenario_id)
        if verdict == "in_scope" and not applies_from_corpus:
            missing_atoms = []

        scope_sections = build_scope_sections(
            statuses={
                "temporal": temporal_status,
                "territorial": territorial_status,
                "material": material_status,
                "exclusions": "fail" if excluded else "pass",
            },
            skip_further=skip_further,
        )

        evaluations.append(
            {
                "regulation": reg,
                "indication": indication,
                "verdict": verdict,
                "reason": reason,
                "blocked_on": blocked_on,
                "skip_further": normalize_skip_further(skip_further),
                "headline": _headline(reg, verdict, reason, blocked_on),
                "derived": {
                    "in_force": temporal_status == "pass",
                    "material": material_status == "pass",
                    "territorial": territorial_status == "pass",
                    "excluded": excluded,
                    "applies": applies,
                    "high_risk_ai": high_risk,
                    "active_phases": phases,
                },
                "dimension_statuses": {
                    "temporal": temporal_status,
                    "territorial": territorial_status,
                    "material": material_status,
                    "exclusions": "fail" if excluded else "pass",
                },
                "scope_sections": scope_sections,
                "final_conclusion_label": FINAL_CONCLUSION_LABEL,
                "actors": sorted({row[3] for row in applies_via if len(row) >= 4}),
                "territorial_links": terr_actor_rows,
                "missing_atoms": missing_atoms,
            }
        )
    return evaluations


def run_universal_reasoner(
    raw_facts: list[dict[str, Any]],
    *,
    case_id: str | None = None,
    active_phases: dict[str, list[str]] | None = None,
    signals: dict[str, str] | None = None,
) -> dict[str, Any]:
    ensure_corpus_ready()
    errors, normalized = validate_ground_facts(raw_facts)
    if errors:
        return {
            "ok": False,
            "message": "validation failed",
            "schema_errors": errors,
            "normalized_facts": [],
            "supported_regulations": list(load_regulations()),
            "reasoning": {"ok": False, "skipped": not souffle_available(), "outputs": {}},
            "evaluations": [],
            "provenance": {"groups": []},
            "defeasibility": {},
        }

    outputs_result = run_corpus_program(
        normalized, output_relations=list(load_output_predicates())
    )
    scenario_id = infer_scenario_id(normalized, fallback=case_id)
    regulations = list(load_regulations())
    evaluations = _evaluate_regulations(
        regulations,
        outputs_result.get("outputs") or {},
        scenario_id,
        active_phases=active_phases,
        signals=signals,
        normalized_facts=normalized,
    )
    provenance = build_provenance(
        normalized_facts=normalized,
        outputs=outputs_result.get("outputs") or {},
        evaluations=evaluations,
        scenario_id=scenario_id,
        active_phases=active_phases or {},
    )
    defeasibility = build_defeasibility(
        evaluations=evaluations,
        provenance=provenance,
    )
    return {
        "ok": bool(outputs_result.get("ok")),
        "message": outputs_result.get("message"),
        "schema_errors": [],
        "normalized_facts": [{"predicate": p, "args": list(a)} for p, a in normalized],
        "supported_regulations": regulations,
        "reasoning": outputs_result,
        "evaluations": evaluations,
        "provenance": provenance,
        "defeasibility": defeasibility,
        "scenario_id": scenario_id,
    }
