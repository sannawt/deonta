"""Magic-link auth, session cookies, and per-account data isolation."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from logic.product_store import load_account_products, save_account_products
from main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    accounts = tmp_path / "accounts"
    accounts.mkdir()
    monkeypatch.setenv("ACCOUNTS_DATA_DIR", str(accounts))
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "app.db"))
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret")
    monkeypatch.setenv("AUTH_DEV_EXPOSE_LINK", "1")
    monkeypatch.setenv("APP_BASE_URL", "http://testserver")
    with TestClient(app) as c:
        yield c


def _sign_in(client: TestClient, email: str) -> str:
    res = client.post("/api/auth/request-link", json={"email": email})
    assert res.status_code == 200, res.text
    verify_url = res.json()["verify_url"]
    token = verify_url.split("token=", 1)[1]
    verify = client.get(f"/api/auth/verify?token={token}", follow_redirects=False)
    assert verify.status_code == 302, verify.text
    cookie = verify.cookies.get("ct_session")
    assert cookie
    return cookie


def test_magic_link_request_verify_and_me(client: TestClient):
    cookie = _sign_in(client, "alice@example.com")
    me = client.get("/api/auth/me", cookies={"ct_session": cookie})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "alice@example.com"
    assert len(body["account_id"]) == 32


def test_logout_clears_session(client: TestClient):
    cookie = _sign_in(client, "bob@example.com")
    out = client.post("/api/auth/logout", cookies={"ct_session": cookie})
    assert out.status_code == 200
    client.cookies.clear()
    me = client.get("/api/auth/me")
    assert me.status_code == 401


def test_protected_route_requires_session(client: TestClient):
    res = client.get("/api/playbooks")
    assert res.status_code == 401


def test_account_products_crud(client: TestClient):
    cookie = _sign_in(client, "carol@example.com")
    cookies = {"ct_session": cookie}

    empty = client.get("/api/account/products", cookies=cookies)
    assert empty.status_code == 200
    assert empty.json()["products"] == []

    product = {
        "id": "prod-1",
        "label": "Test assessment",
        "created_at": 1,
        "updated_at": 2,
        "spec": {
            "name": "Widget",
            "summary": "A widget",
            "markets": ["EU"],
            "processesPersonalData": "no",
            "euLink": "yes",
            "aiSystem": "no",
        },
    }
    put = client.put(
        "/api/account/products",
        cookies=cookies,
        json={"products": [product]},
    )
    assert put.status_code == 200
    assert len(put.json()["products"]) == 1

    patch = client.patch(
        "/api/account/products/prod-1",
        cookies=cookies,
        json={**product, "label": "Updated"},
    )
    assert patch.status_code == 200
    assert patch.json()["product"]["label"] == "Updated"


def test_playbook_isolation_between_users(tmp_path, monkeypatch):
    accounts = tmp_path / "accounts"
    accounts.mkdir()
    monkeypatch.setenv("ACCOUNTS_DATA_DIR", str(accounts))
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "app.db"))
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret")
    monkeypatch.setenv("AUTH_DEV_EXPOSE_LINK", "1")
    monkeypatch.setenv("APP_BASE_URL", "http://testserver")

    with TestClient(app) as client_a, TestClient(app) as client_b:
        cookie_a = _sign_in(client_a, "user-a@example.com")
        cookie_b = _sign_in(client_b, "user-b@example.com")

        me_a = client_a.get("/api/auth/me", cookies={"ct_session": cookie_a}).json()
        me_b = client_b.get("/api/auth/me", cookies={"ct_session": cookie_b}).json()
        assert me_a["account_id"] != me_b["account_id"]

        create = client_a.post(
            "/api/playbooks",
            cookies={"ct_session": cookie_a},
            json={"name": "Company A playbook"},
        )
        assert create.status_code == 200
        playbook_id = create.json()["playbook_id"]

        list_a = client_a.get("/api/playbooks", cookies={"ct_session": cookie_a})
        list_b = client_b.get("/api/playbooks", cookies={"ct_session": cookie_b})
        assert len(list_a.json()["playbooks"]) == 1
        assert list_b.json()["playbooks"] == []

        denied = client_b.get(
            f"/api/playbooks/{playbook_id}",
            cookies={"ct_session": cookie_b},
        )
        assert denied.status_code == 404


def test_products_filesystem_isolation(tmp_path, monkeypatch):
    accounts = tmp_path / "accounts"
    accounts.mkdir()
    monkeypatch.setenv("ACCOUNTS_DATA_DIR", str(accounts))
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "app.db"))
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret")
    monkeypatch.setenv("AUTH_DEV_EXPOSE_LINK", "1")
    monkeypatch.setenv("APP_BASE_URL", "http://testserver")

    with TestClient(app) as client_a, TestClient(app) as client_b:
        cookie_a = _sign_in(client_a, "iso-a@example.com")
        cookie_b = _sign_in(client_b, "iso-b@example.com")
        me_a = client_a.get("/api/auth/me", cookies={"ct_session": cookie_a}).json()
        me_b = client_b.get("/api/auth/me", cookies={"ct_session": cookie_b}).json()

        save_account_products(me_a["account_id"], [{"id": "x", "label": "secret"}])
        assert load_account_products(me_b["account_id"]) == []

        listed = client_b.get("/api/account/products", cookies={"ct_session": cookie_b})
        assert listed.json()["products"] == []
