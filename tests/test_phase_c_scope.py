"""Phase C multi-instrument scope analysis."""

from logic.phase_c_scope import analyse_phase_c_scope
from logic.souffle_runner import run_scope_applicability


def _norm(facts: list[tuple[str, tuple[str, ...]]]) -> list[tuple[str, tuple[str, ...]]]:
    return facts


def test_phase_c_single_gdpr_applies():
    facts = _norm(
        [
            ("case", ("s1",)),
            ("regulation", ("gdpr",)),
            ("processing_personal_data", ("s1",)),
            ("territorial_link_eu", ("s1",)),
            ("law_in_force", ("gdpr",)),
        ]
    )
    out = run_scope_applicability(facts, prefer_souffle=False)
    assert out["ok"]
    pc = analyse_phase_c_scope(facts, out["outputs"])
    assert len(pc["instrument_evaluations"]) == 1
    ev = pc["instrument_evaluations"][0]
    assert ev["instrument_id"] == "GDPR"
    assert ev["verdict"] == "applies"
    assert ev["scope"]["MATERIAL"]["status"] == "pass"
    assert [section["id"] for section in ev["scope_sections"]] == [
        "temporal",
        "territorial",
        "material",
        "exclusions",
    ]
    assert [section["label"] for section in ev["scope_sections"]] == [
        "Temporal scope",
        "Territorial scope",
        "Material scope",
        "Exclusions",
    ]
    assert ev["final_conclusion_label"] == "Final conclusion"
    assert ev["dimensions_satisfied"] == {"passing": 4, "evaluated": 4}
    assert pc["missing_facts"] == []
    assert pc["follow_up_questions"] == []


def test_phase_c_cannot_determine_when_material_unknown():
    facts = _norm(
        [
            ("case", ("s1",)),
            ("regulation", ("gdpr",)),
            ("territorial_link_eu", ("s1",)),
            ("law_in_force", ("gdpr",)),
        ]
    )
    out = run_scope_applicability(facts, prefer_souffle=False)
    assert out["ok"]
    pc = analyse_phase_c_scope(facts, out["outputs"])
    assert pc["instrument_evaluations"][0]["verdict"] == "cannot_determine"
    assert pc["instrument_evaluations"][0]["scope"]["MATERIAL"]["status"] == "cannot_determine"
    assert pc["instrument_evaluations"][0]["skip_further"] == ["exclusions"]
    assert pc["instrument_evaluations"][0]["scope_sections"][3]["skipped"] is True
    assert "processing_personal_data" in pc["missing_facts"]
    assert len(pc["follow_up_questions"]) >= 1


def test_phase_c_two_regulations():
    facts = _norm(
        [
            ("case", ("s1",)),
            ("regulation", ("gdpr",)),
            ("regulation", ("mdr",)),
            ("processing_personal_data", ("s1",)),
            ("territorial_link_eu", ("s1",)),
            ("law_in_force", ("gdpr",)),
            ("law_in_force", ("mdr",)),
        ]
    )
    out = run_scope_applicability(facts, prefer_souffle=False)
    assert out["ok"]
    pc = analyse_phase_c_scope(facts, out["outputs"])
    ids = {e["instrument_id"] for e in pc["instrument_evaluations"]}
    assert ids == {"GDPR", "MDR"}
    for ev in pc["instrument_evaluations"]:
        assert ev["verdict"] == "applies"


def test_phase_c_exclusion_does_not_apply():
    facts = _norm(
        [
            ("case", ("s1",)),
            ("regulation", ("gdpr",)),
            ("processing_personal_data", ("s1",)),
            ("territorial_link_eu", ("s1",)),
            ("law_in_force", ("gdpr",)),
            ("exclusion_holds", ("s1", "gdpr")),
        ]
    )
    out = run_scope_applicability(facts, prefer_souffle=False)
    assert out["ok"]
    pc = analyse_phase_c_scope(facts, out["outputs"])
    ev = pc["instrument_evaluations"][0]
    assert ev["verdict"] == "does_not_apply"
    assert ev["scope"]["EXCLUSION"]["status"] == "fail"
