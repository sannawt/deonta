from logic.fact_extractor import propose_scope_facts


def test_propose_gdpr_personal_eu():
    out = propose_scope_facts(
        "We process personal data and emails for users in Germany. GDPR applies.",
        [],
        [],
    )
    assert out["case_id"].startswith("sit_")
    preds = {f["predicate"] for f in out["facts_json"]}
    assert "processing" in preds
    assert "natural_person" in preds
    assert "concerns" in preds
    assert "identifies" in preds
    assert "data_subjects_in_eu_targeted" in preds
    assert out["signals"]["personal_data"] == "yes"
    assert out["signals"]["eu_link"] == "yes"


def test_propose_default_regulation_when_unmentioned():
    out = propose_scope_facts("Something vague about software.", [], [])
    assert not any(f["predicate"] == "regulation" for f in out["facts_json"])
    assert any("No regulation named" in note for note in out["extractor_notes"])


def test_negated_identifiable_data_does_not_infer_personal_data():
    out = propose_scope_facts(
        (
            "I am selling an AI predictive maintenance system for stamping machines "
            "to factories in Germany and the Netherlands. The system analyses vibration "
            "and sensor data to predict machine failure. It does not use identifiable "
            "worker data."
        ),
        [],
        [],
    )
    preds = {f["predicate"] for f in out["facts_json"]}
    assert "places_on_eu_market" in preds
    assert "has_feature" in preds
    assert "natural_person" not in preds
    assert "identifies" not in preds
    assert out["signals"]["personal_data"] == "no"
    assert out["signals"]["eu_link"] == "yes"
    assert out["signals"]["ai_system"] == "yes"
    assert any(
        "no personal or identifiable data" in note.lower()
        for note in out["extractor_notes"]
    )
