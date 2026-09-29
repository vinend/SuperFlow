import json


def component(workspace, kind):
    return next(item for item in workspace["components"] if item["type"] == kind)


def metric(workspace, key):
    return next(
        value
        for item in workspace["components"]
        if item["type"] == "MetricGroup"
        for value in item["data"]["metrics"]
        if value["key"] == key
    )


def test_impact_is_role_gated_and_payload_uses_only_approved_components(client):
    assert client.get("/api/impact", headers={"X-User-Id": "employee"}).status_code == 403
    response = client.get("/api/impact", headers={"X-User-Id": "governance"})
    assert response.status_code == 200
    workspace = response.json()
    assert workspace["scope"] == "Platform-wide synthetic activity"
    assert workspace["provider"] == "deterministic-impact-composer-v1"
    assert {item["type"] for item in workspace["components"]} <= {
        "ImpactBrief",
        "MetricGroup",
        "DistributionChart",
        "CapacitySimulation",
        "NextActions",
    }
    simulation = component(workspace, "CapacitySimulation")["data"]
    assert simulation["disclosure"] == "Illustrative simulation"
    assert all(item["kind"] == "illustrative_simulation" for item in simulation["metrics"])
    assert "not a claim of realized savings" in simulation["description"]


def test_observed_quality_metrics_come_from_persisted_guard_results(client):
    headers = {"X-User-Id": "governance"}
    answer = client.post(
        "/api/ask",
        headers=headers,
        json={
            "question": "How many annual leave days do employees receive?",
            "domain": "People",
            "document_ids": ["leave-policy"],
            "include_outdated": False,
        },
    )
    assert answer.status_code == 201
    assert answer.json()["reliability"]["status"] == "VERIFIED"

    workspace = client.post(
        "/api/impact",
        headers=headers,
        json={"question": "Where does reliability need attention?"},
    ).json()
    assert workspace["focus"] == "quality"
    assert metric(workspace, "citation_coverage")["value"] == 100
    assert metric(workspace, "verified_rate")["value"] == 100
    assert metric(workspace, "verified_rate")["numerator"] == 1
    assert metric(workspace, "verified_rate")["denominator"] == 1


def test_question_intent_changes_component_composition_and_keeps_simulation_explicit(client):
    headers = {"X-User-Id": "finance"}
    capacity = client.post(
        "/api/impact",
        headers=headers,
        json={"question": "How much capacity and cost could be released?"},
    )
    assert capacity.status_code == 200
    payload = capacity.json()
    assert payload["focus"] == "capacity"
    groups = [item for item in payload["components"] if item["type"] == "MetricGroup"]
    assert [item["data"]["category"] for item in groups] == ["capacity"]
    assert component(payload, "CapacitySimulation")

    delivery = client.post(
        "/api/impact",
        headers=headers,
        json={"question": "Show backlog, throughput, cycle time and escalations"},
    ).json()
    assert delivery["focus"] == "delivery"
    assert not any(item["type"] == "CapacitySimulation" for item in delivery["components"])
    assert [
        item["data"]["category"] for item in delivery["components"] if item["type"] == "MetricGroup"
    ] == ["delivery"]


def test_impact_scope_does_not_expose_another_roles_question_or_source(client):
    client.post(
        "/api/ask",
        headers={"X-User-Id": "finance"},
        json={
            "question": "What is the investment approval authority?",
            "domain": "Finance",
            "document_ids": ["approval-policy"],
            "include_outdated": False,
        },
    )
    response = client.get("/api/impact", headers={"X-User-Id": "manager"})
    assert response.status_code == 200
    body = json.dumps(response.json())
    assert "Investment Approval Authority" not in body
    assert "investment approval authority" not in body.lower()
    assert metric(response.json(), "questions_answered")["value"] == 0
