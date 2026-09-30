"""The workspace agent selects displays; domain APIs keep business authority."""

import json

import httpx
import pytest
from pydantic import ValidationError
from sqlalchemy import select

from superflow.models import Case, User
from superflow.workspace_intent import (
    IntentChoice,
    OllamaIntentProvider,
    WorkspaceKind,
    WorkspacePrompt,
    deterministic_intent,
    resolve_workspace,
)


@pytest.mark.parametrize(
    ("prompt", "expected", "view"),
    [
        ("How many annual leave days do I get?", "knowledge_answer", None),
        ("What changed in the latest regulation?", "regulatory_review", "latest_changes"),
        ("Show me what needs remediation.", "regulatory_review", "remediation"),
        ("Analyze proposal A.", "investment_analysis", "overview"),
        ("What assumptions are in proposal A?", "investment_analysis", "assumptions"),
        ("Investigate alert AML-2026-001.", "investigation_review", "overview"),
        ("Show me the evidence for AML-2026-003.", "investigation_review", "evidence"),
        ("Where does reliability need attention?", "impact", "quality"),
        ("How much capacity could be released?", "impact", "capacity"),
        ("What is slowing delivery?", "impact", "delivery"),
        ("What do I need to do?", "my_work", None),
        ("What needs my approval?", "reviews", None),
        ("What is the investment approval authority?", "knowledge_answer", None),
    ],
)
def test_deterministic_demo_prompts(prompt, expected, view):
    result = deterministic_intent(prompt)
    assert result.intent == expected
    assert result.view == view


def test_unknown_model_intent_and_extra_business_values_fail_closed():
    with pytest.raises(ValidationError):
        IntentChoice.model_validate({"intent": "arbitrary_tool"})
    with pytest.raises(ValidationError):
        IntentChoice.model_validate({"intent": "impact", "npv": 1000000})
    with pytest.raises(ValidationError):
        IntentChoice.model_validate({"intent": "investment_analysis", "view": "quality"})
    with pytest.raises(ValidationError):
        WorkspacePrompt.model_validate({"prompt": "Approve", "route": "/admin"})


def test_model_failure_uses_deterministic_fallback(db):
    employee = db.get(User, "employee")

    class InvalidProvider:
        def choose(self, _):
            return None

    result = resolve_workspace(db, employee, "How many leave days?", InvalidProvider())
    assert result.status == "ready"
    assert result.intent == WorkspaceKind.KNOWLEDGE_QA


def test_ollama_structured_choice_and_malformed_output():
    def good(request):
        body = json.loads(request.content)
        assert body["think"] is False
        assert body["format"]["additionalProperties"] is False
        return httpx.Response(
            200,
            json={"message": {"content": '{"intent":"my_work","view":null}'}},
        )

    assert OllamaIntentProvider(httpx.MockTransport(good)).choose("my tasks").intent == "my_work"
    invalid = OllamaIntentProvider(
        httpx.MockTransport(
            lambda _: httpx.Response(200, json={"message": {"content": "not json"}})
        )
    )
    assert invalid.choose("my tasks") is None


def test_role_gating_and_restricted_reference_never_leak(client):
    for header, prompt in [
        ({"X-User-Id": "employee"}, "Where does reliability need attention?"),
        ({"X-User-Id": "finance"}, "Investigate alert AML-2026-001."),
        ({"X-User-Id": "compliance"}, "Analyze proposal A."),
        ({"X-User-Id": "employee"}, "What needs my approval?"),
    ]:
        result = client.post("/api/workspace-intent", headers=header, json={"prompt": prompt})
        assert result.status_code == 200
        body = result.json()
        assert body["status"] == "denied"
        assert body["intent"] is None
        assert body["investigation_id"] is None
        assert body["alert_reference"] is None
        assert "AML-" not in str(body) and "Proposal" not in str(body)


def test_investigation_reference_reauthorized_and_material_action_only_routes(client, db):
    from superflow.investigations import create_investigation

    analyst = db.get(User, "compliance")
    item = create_investigation(db, analyst, "complete")
    db.commit()
    response = client.post(
        "/api/workspace-intent",
        headers={"X-User-Id": "compliance"},
        json={"prompt": "Investigate alert AML-2026-001."},
    )
    assert response.status_code == 200
    assert response.json()["investigation_id"] == item.case_id
    original_status = db.get(Case, item.case_id).status
    checker = client.post(
        "/api/workspace-intent",
        headers={"X-User-Id": "compliance_checker"},
        json={"prompt": "Investigate alert AML-2026-001."},
    )
    assert checker.json()["status"] == "denied"
    approval = client.post(
        "/api/workspace-intent",
        headers={"X-User-Id": "manager"},
        json={"prompt": "Approve this investment."},
    )
    assert approval.json()["intent"] == "reviews"
    assert db.get(Case, item.case_id).status == original_status
    assert db.scalar(select(Case).where(Case.type == "investment")) is None
