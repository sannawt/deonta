from main import ApplicabilityFlowBody, applicability_flow
from logic.reasoner import run_universal_reasoner


def test_universal_reasoner_returns_supported_regulations():
    out = run_universal_reasoner([{"predicate": "natural_person", "args": ["alice"]}])
    assert "supported_regulations" in out
    assert set(out["supported_regulations"]) >= {"gdpr", "ai_act"}
    assert "evaluations" in out
    assert "provenance" in out
    assert "defeasibility" in out
    if out["evaluations"]:
        first = out["evaluations"][0]
        assert [section["id"] for section in first["scope_sections"]] == [
            "temporal",
            "territorial",
            "material",
            "exclusions",
        ]
        assert [section["label"] for section in first["scope_sections"]] == [
            "Temporal scope",
            "Territorial scope",
            "Material scope",
            "Exclusions",
        ]
        assert first["final_conclusion_label"] == "Final conclusion"


def test_universal_reasoner_emits_missing_atoms_and_regulation_proofs():
    out = run_universal_reasoner([{"predicate": "natural_person", "args": ["alice"]}])
    assert out["evaluations"]
    assert any("missing_atoms" in ev for ev in out["evaluations"])
    assert "by_regulation" in out["provenance"]


def _evaluation_map(response):
    return {
        row["regulation"]: row
        for row in (response.universal or {}).get("evaluations", [])
    }


def test_scenario_a_ai_act_in_scope_and_gdpr_material_no():
    response = applicability_flow(
        ApplicabilityFlowBody(
            situation=(
                "I sell an AI predictive maintenance system to factories in Germany. "
                "No personal data."
            )
        )
    )
    assert response.clarification_required is False
    evaluations = _evaluation_map(response)
    assert evaluations["ai_act"]["verdict"] == "in_scope"
    assert evaluations["gdpr"]["verdict"] == "out_of_scope"
    assert evaluations["gdpr"]["reason"] == "material"
    assert [section["id"] for section in evaluations["gdpr"]["scope_sections"]] == [
        "temporal",
        "territorial",
        "material",
        "exclusions",
    ]


def test_scenario_b_clarifies_ai_then_reaches_high_risk_ai_and_gdpr_scope():
    initial = applicability_flow(
        ApplicabilityFlowBody(
            situation=(
                "We run HR analytics SaaS processing employee performance data for EU companies."
            )
        )
    )
    assert initial.clarification_required is True
    assert any(q["id"] == "aiact_ai_system" for q in initial.clarifying_questions)

    resolved = applicability_flow(
        ApplicabilityFlowBody(
            situation=initial.situation,
            case_id=initial.case_id,
            clarification_answers={"aiact_ai_system": "yes"},
        )
    )
    evaluations = _evaluation_map(resolved)
    assert evaluations["gdpr"]["verdict"] == "in_scope"
    assert evaluations["ai_act"]["verdict"] == "in_scope"
    assert "used_in" in {f["predicate"] for f in (resolved.fact_payload or {}).get("all_facts", [])}


def test_scenario_c_keeps_ai_act_result_but_gdpr_needs_clarification():
    response = applicability_flow(
        ApplicabilityFlowBody(
            situation=(
                "We provide a weather forecasting API using AI models across Europe. "
                "We collect API keys and billing information from customers but no personal data from end users."
            )
        )
    )
    assert response.clarification_required is True
    assert any(q["id"] == "gdpr_personal_data" for q in response.clarifying_questions)
    evaluations = _evaluation_map(response)
    assert evaluations["ai_act"]["verdict"] == "in_scope"
    assert evaluations["gdpr"]["verdict"] == "needs_clarification"
