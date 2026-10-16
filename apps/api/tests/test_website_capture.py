from copy import deepcopy
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from superflow import website_capture
from superflow.config import settings
from superflow.models import WebsiteCapture


def captured():
    return {
        "url": "https://example.org/knowledge",
        "requested_url": "https://example.org/knowledge",
        "title": "Website travel guidance",
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "text": "Website travel reimbursement requires manager approval.",
        "text_truncated": False,
        "coverage": "Top two viewports only.",
        "vision_model": "unit-test-model",
        "screenshots": [{"y": 0, "image": "dGVzdA==", "sha256": "a" * 64}],
        "observations": [
            {
                "screenshot": 1,
                "visible_text": "Manager approval",
                "visual_description": "A heading",
                "limitations": "Small print unclear",
            }
        ],
    }


def metadata():
    return {
        "title": "Website travel guidance",
        "domain": "Operations",
        "owner_id": "sme",
        "authority_level": 5,
        "access_roles": ["sme", "governance"],
        "related_document_ids": [],
    }


def test_capture_is_role_gated_before_browser_or_model(client, employee, monkeypatch):
    def forbidden(*_):
        pytest.fail("Browser must not run for unauthorized actors")

    monkeypatch.setattr(website_capture, "scan_website", forbidden)
    assert (
        client.post(
            "/api/web-sources/preview", headers=employee, json={"url": "https://example.org"}
        ).status_code
        == 403
    )


def test_operator_can_disable_capture(client, admin, monkeypatch):
    monkeypatch.setattr(settings, "web_capture_enabled", False)
    assert (
        client.post(
            "/api/web-sources/preview", headers=admin, json={"url": "https://example.org"}
        ).status_code
        == 503
    )


@pytest.mark.parametrize("url", ["file:///etc/passwd", "https://user:secret@example.org"])
def test_invalid_urls_rejected(client, admin, url):
    assert (
        client.post("/api/web-sources/preview", headers=admin, json={"url": url}).status_code == 422
    )


def test_preview_save_evidence_permissions_and_guard(client, db, monkeypatch):
    monkeypatch.setattr(website_capture, "scan_website", lambda _: deepcopy(captured()))
    headers = {"X-User-Id": "sme"}
    response = client.post(
        "/api/web-sources/preview", headers=headers, json={"url": "https://example.org"}
    )
    assert response.status_code == 200
    preview = response.json()
    save = {"capture_id": preview["id"], "reviewed": True, "metadata": metadata()}
    assert (
        client.post("/api/web-sources", headers={"X-User-Id": "governance"}, json=save).status_code
        == 404
    )
    assert (
        client.post(
            "/api/web-sources", headers=headers, json={**save, "reviewed": False}
        ).status_code
        == 422
    )
    document = client.post("/api/web-sources", headers=headers, json=save).json()
    version = document["versions"][0]
    assert version["status"] == "draft"
    assert not any("A heading" in c["text"] for c in version["chunks"])
    assert all(c["extraction_method"] == "web_capture" for c in version["chunks"])
    assert client.post("/api/web-sources", headers=headers, json=save).status_code == 409
    url = f"/api/documents/{document['id']}/versions/{version['id']}/web-capture"
    assert client.get(url, headers={"X-User-Id": "employee"}).status_code == 404
    assert client.get(url, headers=headers).json()["screenshots"] == preview["screenshots"]
    assert client.get(url, headers=headers).json()["observations"] == preview["observations"]
    client.patch(
        f"/api/documents/{document['id']}/versions/{version['id']}?status=active", headers=headers
    )
    assert client.post(f"/api/documents/{document['id']}/index", headers=headers).status_code == 200
    answer = client.post(
        "/api/ask",
        headers=headers,
        json={
            "question": "Website travel reimbursement manager approval",
            "document_ids": [document["id"]],
        },
    ).json()
    assert answer["sources"] and all(
        s["extraction_method"] == "web_capture" for s in answer["sources"]
    )
    assert answer["reliability"]["status"] == "REVIEW_REQUIRED"
    assert answer["reliability"]["policy_version"] == "guard-website-review-v1"
    assert db.scalar(select(WebsiteCapture)).version_id == version["id"]


def test_expired_preview_cannot_be_imported(client, db):
    capture = WebsiteCapture(
        actor_id="sme",
        payload=captured(),
        created_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    db.add(capture)
    db.commit()
    response = client.post(
        "/api/web-sources",
        headers={"X-User-Id": "sme"},
        json={"capture_id": capture.id, "reviewed": True, "metadata": metadata()},
    )
    assert response.status_code == 409


def test_browser_failure_has_no_synthetic_fallback(monkeypatch):
    class Failed:
        returncode = 1

    monkeypatch.setattr(website_capture.subprocess, "run", lambda *a, **k: Failed())
    with pytest.raises(website_capture.HTTPException) as error:
        website_capture.scan_website("https://example.org")
    assert error.value.status_code == 422


def test_vision_failure_has_no_synthetic_fallback(monkeypatch):
    import json

    class Process:
        returncode = 0
        stdout = json.dumps(captured())

    class Client:
        def __init__(self, **_):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def post(self, *a, **k):
            raise website_capture.httpx.ConnectError("offline")

    monkeypatch.setattr(website_capture.subprocess, "run", lambda *a, **k: Process())
    monkeypatch.setattr(website_capture.httpx, "Client", Client)
    with pytest.raises(website_capture.HTTPException) as error:
        website_capture.scan_website("https://example.org")
    assert error.value.status_code == 503
