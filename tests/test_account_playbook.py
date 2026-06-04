"""Account playbook storage and product KG merge."""

from logic.account_store import ensure_account, new_account_id, normalize_account_id
from logic.playbook_merge import create_playbook, get_playbook, list_playbooks, playbook_matches_for_assess
from logic.product_kg import build_product_kg
from logic.product_parse import parse_description


def test_account_and_playbook_crud(tmp_path, monkeypatch):
    monkeypatch.setenv("ACCOUNTS_DATA_DIR", str(tmp_path))
    aid = new_account_id()
    ensure_account(aid)
    doc = create_playbook(aid, "Acme Corp")
    assert doc["playbook_id"]
    listed = list_playbooks(aid)
    assert len(listed) == 1
    loaded = get_playbook(aid, doc["playbook_id"])
    assert loaded and loaded["name"] == "Acme Corp"


def test_parse_and_kg_with_playbook(tmp_path, monkeypatch):
    monkeypatch.setenv("ACCOUNTS_DATA_DIR", str(tmp_path))
    aid = new_account_id()
    doc = create_playbook(aid, "TestCo")
    parsed = parse_description(
        "Cloud HR platform processes employee personal data in the EU. Uses machine learning."
    )
    assert parsed["processesPersonalData"] in ("yes", "unknown")
    kg = build_product_kg(
        account_id=aid,
        playbook_id=doc["playbook_id"],
        description=parsed["summary"],
    )
    assert len(kg["nodes"]) >= 2
    types = {n["type"] for n in kg["nodes"]}
    assert "Scenario" in types
    matches = playbook_matches_for_assess(aid, doc["playbook_id"], ["employee", "data"])
    assert matches.get("account_playbook") is True


def test_normalize_account_id():
    aid = new_account_id()
    assert normalize_account_id(aid) == aid
    assert normalize_account_id("invalid") is None
