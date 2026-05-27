from logic.scenario_store import append_fact, clear_scenarios, get_scenario, upsert_scenario


def test_scenario_store_records_source_and_status():
    clear_scenarios()
    rec = upsert_scenario(
        "sit_test",
        facts=[{"predicate": "regulation", "args": ["gdpr"], "source": "rules", "status": "extracted"}],
    )
    assert rec["scenario_id"] == "sit_test"
    assert rec["facts"][0]["source"] == "rules"
    assert rec["facts"][0]["status"] == "extracted"


def test_append_fact_dedupes():
    clear_scenarios()
    append_fact("sit_test", predicate="regulation", args=["gdpr"])
    append_fact("sit_test", predicate="regulation", args=["gdpr"])
    rec = get_scenario("sit_test")
    assert rec is not None
    assert len(rec["facts"]) == 1
