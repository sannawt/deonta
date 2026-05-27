from logic.display_tokens import (
    ACTOR_LABEL,
    SCENARIO_LABEL,
    format_fact_value,
    format_proof_gap_message,
    friendly_token,
    is_internal_case_id,
)


def test_session_id_detected():
    assert is_internal_case_id("dq1qnyj9mpnsbmdl")
    assert is_internal_case_id("sit_abc123")
    assert not is_internal_case_id("your_org")
    assert not is_internal_case_id("Finland")


def test_friendly_token_mapping():
    assert friendly_token("your_org") == ACTOR_LABEL
    assert friendly_token("dq1qnyj9mpnsbmdl", case_id="dq1qnyj9mpnsbmdl") == SCENARIO_LABEL


def test_proof_gap_hidden_when_exclusions_pass():
    assert (
        format_proof_gap_message(
            atom='regulation_excluded("gdpr", "sit_x")',
            engine_note="Expected atom is not derived for the current facts",
            dimension="exclusions",
            dim_result="PASS",
            regulation_label="GDPR",
        )
        is None
    )


def test_data_subjects_in_eu_targeted_phrase():
    text = format_fact_value(
        "data_subjects_in_eu_targeted",
        ["dq1qnyj9mpnsbmdl", "your_org"],
        case_id="dq1qnyj9mpnsbmdl",
    )
    assert "your organisation" in text
    assert "dq1qnyj9" not in text


def test_case_suffix_tokens_mapped():
    assert friendly_token("dq1qnyj9mpnsbmdl_person") == "a data subject"
    assert friendly_token("sit_abc123_datum") == "a data item"
