"""Account playbook storage and product KG merge."""

import pytest
from fastapi.testclient import TestClient

from logic.account_store import ensure_account, new_account_id, normalize_account_id
from logic.playbook_merge import create_playbook, get_playbook, list_playbooks, playbook_matches_for_assess
from logic.product_kg import build_product_kg
from logic.product_parse import parse_description
from main import app


@pytest.fixture
def auth_client(tmp_path, monkeypatch):
    accounts = tmp_path / "accounts"
    accounts.mkdir()
    monkeypatch.setenv("ACCOUNTS_DATA_DIR", str(accounts))
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    monkeypatch.setenv("AUTH_SECRET", "test-secret")
    monkeypatch.setenv("AUTH_DEV_EXPOSE_LINK", "1")
    monkeypatch.setenv("APP_BASE_URL", "http://testserver")
    with TestClient(app) as client:
        yield client


def _session_cookie(client: TestClient, email: str) -> str:
    res = client.post("/api/auth/request-link", json={"email": email})
    token = res.json()["verify_url"].split("token=", 1)[1]
    verify = client.get(f"/api/auth/verify?token={token}", follow_redirects=False)
    return verify.cookies["ct_session"]


def test_playbook_api_uses_session_auth(auth_client: TestClient):
    cookie = _session_cookie(auth_client, "playbook-user@example.com")
    created = auth_client.post(
        "/api/playbooks",
        cookies={"ct_session": cookie},
        json={"name": "Session playbook"},
    )
    assert created.status_code == 200
    listed = auth_client.get("/api/playbooks", cookies={"ct_session": cookie})
    assert len(listed.json()["playbooks"]) == 1


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
    assert "Product" in types
    matches = playbook_matches_for_assess(aid, doc["playbook_id"], ["employee", "data"])
    assert matches.get("account_playbook") is True


def test_normalize_account_id():
    aid = new_account_id()
    assert normalize_account_id(aid) == aid
    assert normalize_account_id("invalid") is None
