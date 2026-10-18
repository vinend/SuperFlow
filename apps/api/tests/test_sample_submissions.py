from sqlalchemy import func, select

from superflow.models import Approval, Case, Document, Investigation, InvestmentAnalysis
from superflow.sample_submissions import prepare_samples


def test_samples_create_pending_reviews_with_evidence_and_preserve_existing_work(client, db):
    # An existing user investigation must not be advanced by sample preparation.
    original = client.post(
        "/api/investigations",
        headers={"X-User-Id": "compliance"},
        json={"scenario": "complete"},
    ).json()
    result = prepare_samples(db)
    assert len(result) == 12 and all(item["created"] for item in result)
    approvals = list(db.scalars(select(Approval)))
    assert len(approvals) == 10
    assert all(item.status == "PENDING" for item in approvals)
    assert [a.requested_from for a in approvals].count("compliance_checker") == 4
    assert [a.requested_from for a in approvals].count("manager") == 4
    assert [a.requested_from for a in approvals].count("governance") == 2
    for item in result:
        case = db.get(Case, item["id"])
        assert case.title.startswith("[Sample]")
        path = "investment-analyses" if item["type"] == "investment" else "investigations"
        actor = "finance" if item["type"] == "investment" else "compliance"
        response = client.get(f"/api/{path}/{case.id}", headers={"X-User-Id": actor})
        assert response.status_code == 200, response.text
        view = response.json()
        if item["type"] == "investment":
            assert view["phase"] == "IN_APPROVAL"
            assert view["calculation"] and view["submitted_at"]
            assert all(input_["assumptions"][0]["source"]["chunk_id"] for input_ in view["inputs"])
        else:
            if view["scenario"] == "failed_evidence":
                assert view["approval_status"] is None
                assert view["reliability"]["status"] == "BLOCKED"
            else:
                assert view["approval_status"] == "PENDING"
            assert len(view["tool_runs"]) == 4
            assert "Synthetic training" in view["analyst_notes"]
        denied = client.get(f"/api/{path}/{case.id}", headers={"X-User-Id": "employee"})
        assert denied.status_code in {403, 404}
    assert db.get(Investigation, original["id"]).submitted_at is None
    # Re-running must preserve sample edits/decisions instead of recreating reviews.
    sample_case = db.get(Case, result[0]["id"])
    sample_case.title = "Reviewer edited title"
    db.flush()
    again = prepare_samples(db)
    assert {item["id"] for item in again} == {item["id"] for item in result}
    assert not any(item["created"] for item in again)
    assert sample_case.title == "Reviewer edited title"
    assert db.scalar(select(func.count()).select_from(Approval)) == 10
    assert db.scalar(select(func.count()).select_from(InvestmentAnalysis)) == 6
    assert (
        db.scalar(select(func.count()).select_from(Document).where(Document.id.like("sample-%")))
        == 7
    )
