"""
Applicability / scope testing (aligns with workbook `scope_tag` + Legend ORCHESTRATION).

Golden Soufflé program encodes a minimal orchestration:
  material ∧ territorial ∧ temporal ∧ ¬exclusion  ⇒  law_applies

Full `articles_rules.json` rows are tagged MATERIAL, TERRITORIAL, TEMPORAL, EXCLUSION, …;
this toy program is the test harness shape those rows eventually compile into.
"""

from __future__ import annotations

from typing import Any

# Extensional predicates accepted by rules/golden/scope_applicability.dl (case + regulation + scope inputs).
SCOPE_TEST_ARITIES: dict[str, int] = {
    "case": 1,
    "regulation": 1,
    "processing_personal_data": 1,
    "territorial_link_eu": 1,
    "law_in_force": 1,
    "exclusion_holds": 2,
}


def validate_scope_facts(
    facts: list[dict[str, Any]],
) -> tuple[list[str], list[tuple[str, tuple[str, ...]]]]:
    errors: list[str] = []
    normalized: list[tuple[str, tuple[str, ...]]] = []
    for i, raw in enumerate(facts):
        if not isinstance(raw, dict):
            errors.append(f"facts[{i}]: must be an object")
            continue
        pred = raw.get("predicate")
        args = raw.get("args", [])
        if pred is None or not str(pred).strip():
            errors.append(f"facts[{i}]: missing predicate")
            continue
        name = str(pred).strip()
        if name not in SCOPE_TEST_ARITIES:
            errors.append(
                f"facts[{i}]: predicate {name!r} not allowed in scope_applicability profile "
                f"(allowed: {', '.join(sorted(SCOPE_TEST_ARITIES))})"
            )
            continue
        if not isinstance(args, list):
            errors.append(f"facts[{i}]: args must be a list")
            continue
        exp = SCOPE_TEST_ARITIES[name]
        str_args = tuple(str(a) for a in args)
        if len(str_args) != exp:
            errors.append(
                f"facts[{i}]: {name!r} expects arity {exp}, got {len(str_args)}"
            )
            continue
        normalized.append((name, str_args))
    return errors, normalized


def build_applicability_report(outputs: dict[str, list[list[str]]]) -> dict[str, Any]:
    """Turn Soufflé CSV rows into a single JSON-friendly applicability summary."""
    mat = outputs.get("material_scope_ok") or []
    ter = outputs.get("territorial_scope_ok") or []
    tmp = outputs.get("temporal_scope_ok") or []
    exc = outputs.get("excluded") or []
    app = outputs.get("law_applies") or []
    return {
        "dimensions": {
            "MATERIAL": {"passed_pairs": mat, "pass": bool(mat)},
            "TERRITORIAL": {"passed_pairs": ter, "pass": bool(ter)},
            "TEMPORAL": {"passed_pairs": tmp, "pass": bool(tmp)},
            "EXCLUSION": {"triggered_pairs": exc, "pass": not bool(exc)},
        },
        "law_applies": app,
        "verdict": "applies" if app else "does_not_apply",
        "note": "Toy orchestration for tests; map real rules from articles_rules.json by scope_tag.",
    }
