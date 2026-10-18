from superflow.config import settings
from superflow.models import WebsiteCapture

ANALYST = {"X-User-Id": "compliance"}


def intake():
    return {
        "alert_reference": "REAL-IMPORT-001",
        "subject_reference": "RECORD-001",
        "profile": {
            "customer_name": "Test Research Subject",
            "occupation": "Business owner",
            "declared_source_of_funds": "Business receipts",
            "profile_baseline": "100 million monthly",
        },
        "transactions": {
            "count": 2,
            "window_hours": 24,
            "alerted_value_idr": 20000000,
            "new_beneficiaries": 1,
            "sample": [],
            "narrative": "Supplier payment",
        },
        "record_source": "Authorized staging test import, not a live banking connector.",
    }


def create(client, monkeypatch):
    monkeypatch.setattr(settings, "investigation_provider", "browser")
    response = client.post("/api/investigations", headers=ANALYST, json={"intake": intake()})
    assert response.status_code == 201, response.text
    return response.json()


def tool(client, item, name):
    return client.post(
        f"/api/investigations/{item['id']}/tools/{name}",
        headers=ANALYST,
        json={"expected_revision": item["revision"]},
    )


def test_browser_research_preserves_sources_and_never_confirms_identity(client, db, monkeypatch):
    def scan(url, **kwargs):
        if kwargs.get("search_query"):
            return {
                "url": url,
                "results": [{"url": "https://main.un.org/securitycouncil/sanctions"}],
                "blocked": False,
                "observations": [],
                "screenshots": [],
            }
        return {
            "url": url,
            "title": "Official public source",
            "text": "A public source excerpt that requires analyst identity verification.",
            "observations": [
                {
                    "visible_text": "Source text",
                    "visual_description": "A public page",
                    "limitations": "Identity unverified",
                }
            ],
            "screenshots": [],
        }

    monkeypatch.setattr("superflow.browser_screening.scan_website", scan)
    item = create(client, monkeypatch)
    assert item["scenario"] == "submitted"
    assert item["tool_runs"][0]["result"]["customer_name"] == "Test Research Subject"
    item = tool(client, item, "run_watchlist_screening").json()
    item = tool(client, item, "search_adverse_news").json()
    assert item["reliability"]["status"] == "REVIEW_REQUIRED"
    result = item["tool_runs"][-1]["result"]
    assert result["provider"] == "google-puppeteer-vision"
    assert result["identity_confirmed"] is False
    assert "exact_match" not in result
    capture_id = result["sources"][0]["capture_id"]
    assert db.get(WebsiteCapture, capture_id)
    path = f"/api/investigations/{item['id']}/captures/{capture_id}"
    assert client.get(path, headers=ANALYST).status_code == 200
    assert client.get(path, headers={"X-User-Id": "employee"}).status_code == 404


def test_google_block_is_missing_evidence_and_synthetic_intake_disabled(client, monkeypatch):
    monkeypatch.setattr(
        "superflow.browser_screening.scan_website",
        lambda *a, **k: {"blocked": True, "http_status": 429},
    )
    item = create(client, monkeypatch)
    failed = tool(client, item, "run_watchlist_screening")
    assert failed.status_code == 200, failed.text
    item = failed.json()
    assert item["reliability"]["status"] == "BLOCKED"
    assert item["tool_runs"][-1]["status"] == "failed"
    assert item["tool_runs"][-1]["result"] == {}
    assert (
        client.post(
            "/api/investigations", headers=ANALYST, json={"scenario": "complete"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/investigations/{item['id']}/submit",
            headers=ANALYST,
            json={"expected_revision": item["revision"]},
        ).status_code
        == 409
    )


def test_blocked_google_capture_skips_vision(monkeypatch):
    import json
    from types import SimpleNamespace

    from superflow import website_capture

    monkeypatch.setattr(
        website_capture.subprocess,
        "run",
        lambda *a, **k: SimpleNamespace(
            returncode=0,
            stdout=json.dumps({"blocked": True, "http_status": 429, "screenshots": []}),
        ),
    )

    def unexpected_vision(*args):
        raise AssertionError("Blocked search must not load the vision model")

    monkeypatch.setattr(website_capture, "observe_screenshots", unexpected_vision)
    result = website_capture.scan_website("https://www.google.com/search", search_query="sanctions")
    assert result["vision_status"] == "skipped-blocked" and result["observations"] == []
