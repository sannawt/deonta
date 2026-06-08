"""Tests for per-law assess payload normalization and antenna-kit fixture."""

from logic.assess_pipeline import _normalize_catalog_codes, _normalize_selected_laws
from logic.llm_scope_assess import catalog_to_instrument_id, pending_instrument
from logic.scope_analysis import build_scope_analysis


ANTENNA_LAW_CODES = [
    "rohs",
    "cra",
    "gdpr",
    "gpsr",
    "product_liability",
    "data_act",
    "nis2",
    "reach",
    "ai_act",
    "eprivacy",
    "eecc",
    "red",
    "weee",
]


def test_normalize_catalog_codes_keeps_all_selected():
    out = _normalize_catalog_codes(ANTENNA_LAW_CODES)
    assert len(out) == len(ANTENNA_LAW_CODES)
    assert "gpsr" in out
    assert "red" in out


def test_normalize_selected_laws_builds_rows_for_all_codes():
    rows = _normalize_selected_laws(
        [
            {
                "code": "gpsr",
                "ui_label": "General product safety",
                "engine_mode": "retrieval_only",
                "score": 0.91,
            }
        ],
        ANTENNA_LAW_CODES,
    )
    assert len(rows) == len(ANTENNA_LAW_CODES)
    by_code = {r["code"]: r for r in rows}
    assert by_code["gpsr"]["ui_label"] == "General product safety"
    assert by_code["gdpr"]["engine_mode"] == "symbolic"
    assert by_code["red"]["engine_mode"] == "retrieval_only"


def _symbolic_applicability():
    return {
        "GDPR": {
            "verdict": "applies",
            "headline": "GDPR applies",
            "missing_atoms": [],
            "trace": [{"dimension": "material", "result": "pass", "evidence": "PD"}],
        },
        "EU_AI_ACT": {
            "verdict": "cannot_determine",
            "headline": "AI Act open",
            "missing_atoms": [],
            "trace": [{"dimension": "material", "result": "cannot_determine", "evidence": ""}],
        },
    }


def test_antenna_kit_fourteen_law_scope_instruments():
    selected = _normalize_selected_laws(None, ANTENNA_LAW_CODES)
    llm_instruments = []
    for row in selected:
        if row["code"] in ("gdpr", "ai_act"):
            continue
        inst = pending_instrument(row)
        inst["assessment_source"] = "llm_assisted"
        inst["id"] = catalog_to_instrument_id(row["code"])
        inst["verdict"] = "cannot_determine"
        llm_instruments.append(inst)

    out = build_scope_analysis(
        applicability_results=_symbolic_applicability(),
        provenance={"by_regulation": {}},
        rule_catalog=[],
        llm_instruments=llm_instruments,
        selected_laws=selected,
    )
    assert len(out["instruments"]) == len(ANTENNA_LAW_CODES)
    reg_keys = {i.get("reg_key") for i in out["instruments"]}
    assert reg_keys == set(ANTENNA_LAW_CODES)
