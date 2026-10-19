import pytest
from sqlalchemy.orm import Session

from superflow import conversations, main
from superflow.models import Document
from superflow.providers import ExtractiveDemoProvider


@pytest.fixture(autouse=True)
def chat_worker(db, monkeypatch):
    connection = db.connection()
    monkeypatch.setattr(
        conversations,
        "SessionLocal",
        lambda: Session(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        ),
    )
    queued = []

    class DeferredPool:
        def submit(self, function, turn_id):
            queued.append((function, turn_id))

    monkeypatch.setattr(main, "web_search_pool", DeferredPool())
    return queued


def create(client, headers):
    response = client.post("/api/chats", headers=headers)
    assert response.status_code == 201
    return response.json()["id"]


def submit(client, headers, chat_id, question, **scope):
    response = client.post(
        f"/api/chats/{chat_id}/turns", headers=headers, json={"question": question, **scope}
    )
    assert response.status_code == 202, response.text
    return response.json()["id"]


def finish(db, queued):
    function, turn_id = queued.pop(0)
    function(turn_id)
    db.expire_all()


def test_saved_chat_follow_up_context_and_durable_process(
    client, db, employee, chat_worker, monkeypatch
):
    prompts = []

    class RecordingProvider(ExtractiveDemoProvider):
        def answer(self, question, sources):
            prompts.append(question)
            return super().answer(question, sources)

    monkeypatch.setattr(main, "provider", RecordingProvider())
    chat_id = create(client, employee)
    first_id = submit(client, employee, chat_id, "How many annual leave days do I get?")
    finish(db, chat_worker)
    second_id = submit(client, employee, chat_id, "Summarize that in three points.")
    finish(db, chat_worker)
    result = client.get(f"/api/chats/{chat_id}", headers=employee).json()
    assert len(result["turns"]) == 2
    first, second = result["turns"]
    assert first["answer"]["id"] != second["answer"]["id"]
    assert "15 days" in second["answer"]["answer"]
    assert "How many annual leave days" in prompts[1]
    assert "Current user question: Summarize that" in prompts[1]
    assert "[1]" not in prompts[1]
    assert second["answer"]["question"] == "Summarize that in three points."
    assert [e["stage"] for e in second["events"]] == [
        "queued",
        "routing",
        "context",
        "retrieving",
        "generating",
        "verifying",
        "complete",
    ]
    assert all(e["at"] for e in second["events"])
    assert (
        client.get(f"/api/chats/{chat_id}/turns/{first_id}", headers=employee).json()["status"]
        == "complete"
    )
    assert (
        client.get(f"/api/chats/{chat_id}/turns/{second_id}", headers=employee).json()["events"]
        == second["events"]
    )


def test_chat_owner_isolation_pending_order_and_title(client, employee, admin, db, chat_worker):
    chat_id = create(client, employee)
    turn_id = submit(client, employee, chat_id, "How many annual leave days do I get?")
    assert (
        client.post(
            f"/api/chats/{chat_id}/turns", headers=employee, json={"question": "Another question"}
        ).status_code
        == 409
    )
    assert client.get("/api/chats", headers=admin).json() == []
    for endpoint in [f"/api/chats/{chat_id}", f"/api/chats/{chat_id}/turns/{turn_id}"]:
        assert client.get(endpoint, headers=admin).status_code == 404
    assert (
        client.patch(f"/api/chats/{chat_id}", headers=admin, json={"title": "stolen"}).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/chats/{chat_id}/turns", headers=admin, json={"question": "stolen"}
        ).status_code
        == 404
    )
    finish(db, chat_worker)
    assert (
        client.patch(
            f"/api/chats/{chat_id}", headers=employee, json={"title": "Leave planning"}
        ).json()["title"]
        == "Leave planning"
    )
    assert client.get("/api/chats", headers=employee).json()[0]["title"] == "Leave planning"


def test_revoked_evidence_is_not_reused_in_follow_up(client, employee, db, chat_worker):
    chat_id = create(client, employee)
    submit(client, employee, chat_id, "How many annual leave days do I get?")
    finish(db, chat_worker)
    first = client.get(f"/api/chats/{chat_id}", headers=employee).json()["turns"][0]
    for source in first["answer"]["sources"]:
        doc = db.get(Document, source["document_id"])
        doc.access_roles = ["governance"]
    db.commit()
    submit(client, employee, chat_id, "Tell me more about that.")
    finish(db, chat_worker)
    result = client.get(f"/api/chats/{chat_id}", headers=employee).json()
    assert result["turns"][0]["answer"] is None
    assert result["turns"][1]["status"] == "failed"
    assert result["turns"][1]["answer"] is None
    assert "no longer available" in result["turns"][1]["error"]
    assert "15 days" not in str(result)


def test_chat_domain_routing_preserves_permissions(client, employee, db, chat_worker):
    chat_id = create(client, employee)
    submit(client, employee, chat_id, "Analyze proposal A.", workspace={"intent": "my_work"})
    finish(db, chat_worker)
    turn = client.get(f"/api/chats/{chat_id}", headers=employee).json()["turns"][0]
    assert turn["resolution"]["status"] == "denied"
    assert turn["answer"] is None
    assert [e["stage"] for e in turn["events"]] == ["queued", "routing", "complete"]


def test_saved_denial_is_not_rewritten_as_an_available_workspace(client, employee, db, chat_worker):
    chat_id = create(client, employee)
    submit(
        client,
        employee,
        chat_id,
        "How many annual leave days do employees receive?",
        workspace={"intent": "investigation_review"},
    )
    finish(db, chat_worker)
    turn = client.get(f"/api/chats/{chat_id}", headers=employee).json()["turns"][0]
    assert turn["status"] == "complete"
    assert turn["resolution"]["status"] == "denied"
    assert turn["answer"] is None


def test_chat_websearch_and_restart_failure(client, employee, db, chat_worker, monkeypatch):
    monkeypatch.setattr(main, "collect_web_context", lambda *_: [])
    chat_id = create(client, employee)
    submit(client, employee, chat_id, "How many annual leave days?", web_search=True)
    finish(db, chat_worker)
    turn = client.get(f"/api/chats/{chat_id}", headers=employee).json()["turns"][0]
    assert turn["answer"] is not None
    assert "web_search" in [e["stage"] for e in turn["events"]]
    submit(client, employee, chat_id, "Summarize that.")
    conversations.recover_chats()
    db.expire_all()
    turn = client.get(f"/api/chats/{chat_id}", headers=employee).json()["turns"][-1]
    assert turn["status"] == "failed"
    assert "restarted" in turn["error"]
    assert turn["events"][-1]["stage"] == "failed"


def test_continue_legacy_answer_keeps_original_and_allows_follow_up(
    client, employee, db, chat_worker, admin
):
    run = client.post(
        "/api/ask", headers=employee, json={"question": "How many annual leave days?"}
    ).json()
    assert client.post(f"/api/chats/from-answer/{run['id']}", headers=admin).status_code == 404
    chat = client.post(f"/api/chats/from-answer/{run['id']}", headers=employee).json()
    assert chat["turns"][0]["answer"]["id"] == run["id"]
    assert chat["turns"][0]["events"][0]["stage"] == "restored"
    reopened = client.post(f"/api/chats/from-answer/{run['id']}", headers=employee).json()
    assert reopened["id"] == chat["id"]
    submit(client, employee, chat["id"], "Explain that more simply.")
    finish(db, chat_worker)
    result = client.get(f"/api/chats/{chat['id']}", headers=employee).json()
    assert result["turns"][1]["answer"] is not None
