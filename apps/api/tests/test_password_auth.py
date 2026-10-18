from datetime import timedelta

import pytest
from sqlalchemy import select

from superflow.config import Settings, settings
from superflow.models import AuthSession, User, UserCredential, now
from superflow.password_auth import set_password, token_digest

PASSWORD = "staging test password 10482"
ORIGIN = {"Origin": "http://testserver"}


@pytest.fixture
def account(db, monkeypatch):
    monkeypatch.setattr(settings, "auth_mode", "password")
    monkeypatch.setattr(settings, "public_app_url", "http://testserver")
    user = db.get(User, "finance")
    set_password(db, user, PASSWORD)
    db.commit()
    return user


def login(client, user, password=PASSWORD, headers=ORIGIN):
    return client.post(
        "/api/auth/login", json={"email": user.email, "password": password}, headers=headers
    )


def test_password_session_blocks_identity_spoof_and_revokes_on_logout(client, db, account):
    assert client.get("/api/documents", headers={"X-User-Id": "governance"}).status_code == 401
    response = login(client, account)
    assert response.status_code == 200, response.text
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie
    token = client.cookies.get("superflow-session")
    session = db.scalar(select(AuthSession))
    assert session.token_hash == token_digest(token) and session.token_hash != token
    assert db.get(UserCredential, account.id).password_hash.startswith("$argon2id$")
    me = client.get("/api/auth/me", headers={"X-User-Id": "governance"})
    assert me.json()["id"] == "finance"
    assert [user["id"] for user in client.get("/api/users").json()] == ["finance"]
    assert (
        client.post("/api/auth/logout", headers={"Origin": "https://evil.example"}).status_code
        == 403
    )
    assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set("superflow-session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_login_csrf_expiry_and_password_reset(client, db, account):
    assert login(client, account, headers={}).status_code == 403
    assert login(client, account).status_code == 200
    session = db.scalar(select(AuthSession))
    session.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/auth/me").status_code == 401
    assert login(client, account).status_code == 200
    set_password(db, account, "replacement password with sufficient length")
    db.commit()
    assert client.get("/api/auth/me").status_code == 401
    assert login(client, account).status_code == 401


def test_repeated_failures_lock_account_without_revealing_existence(client, account):
    for _ in range(5):
        response = login(client, account, password="wrong")
        assert response.status_code == 401
    assert login(client, account).status_code == 401
    unknown = client.post(
        "/api/auth/login",
        json={"email": "missing@example.test", "password": "wrong"},
        headers=ORIGIN,
    )
    assert unknown.json() == response.json()


def test_staging_configuration_rejects_mock_auth_and_screening():
    with pytest.raises(ValueError):
        Settings(_env_file=None, app_environment="staging")
    configured = Settings(
        _env_file=None,
        app_environment="staging",
        auth_mode="password",
        investigation_provider="browser",
        public_app_url="https://stg.example.test",
    )
    assert configured.auth_mode == "password"
