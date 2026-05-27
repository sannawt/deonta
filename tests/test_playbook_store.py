from logic.playbook_store import (
    PLAYBOOK_COMPANIES,
    company_by_id,
    filter_playbook_terms,
    playbook_nodes_to_fact_rows,
    rank_playbook_for_display,
    _term_hits,
)


def test_company_by_id():
    assert company_by_id("iloq")["prefix"] == "Iloq"
    assert company_by_id("Atlas Copco") is None
    assert company_by_id("atlascopco")["label"] == "Atlas Copco"


def test_filter_playbook_terms():
    terms = filter_playbook_terms(["in", "the", "payroll", "finland", "hr"])
    assert "in" not in terms
    assert "payroll" in terms


def test_playbook_nodes_to_fact_rows():
    matches = [
        {
            "labels": ["Vaisala_Product", "Vaisala_AISystem"],
            "id": "n1",
            "properties": {"name": "Xweather", "is_ai_system": True},
        }
    ]
    rows = playbook_nodes_to_fact_rows(matches, company_id="vaisala")
    assert len(rows) == 1
    assert rows[0]["source"] == "playbook"
    assert "Xweather" in rows[0]["value"]


def test_rank_playbook_caps_and_penalizes_jurisdiction():
    matches = [
        {
            "labels": ["Iloq_Jurisdiction"],
            "id": "j1",
            "properties": {"name": "Finland"},
        },
        {
            "labels": ["Iloq_Product", "Iloq_AISystem"],
            "id": "p1",
            "properties": {"name": "iLOQ Cloud", "is_ai_system": True},
        },
    ]
    primary, extended = rank_playbook_for_display(
        matches,
        company_id="iloq",
        terms=["payroll", "cloud"],
        question="Cloud HR payroll system",
        missing_atoms=['has_feature("x", "machine_based")'],
        display_cap=8,
    )
    assert len(primary) <= 8
    fields = [r["field"] for r in primary]
    assert any("Product" in f or "product" in f.lower() for f in fields)


def test_term_hits():
    assert _term_hits("finland payroll", ["finland"]) == 1


def test_three_companies_defined():
    ids = {c["id"] for c in PLAYBOOK_COMPANIES}
    assert ids == {"vaisala", "iloq", "atlascopco"}
