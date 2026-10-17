import uuid

from superflow import ask_progress, main
from superflow.providers import ProviderUnavailable


def test_progress_tracks_real_backend_stage_and_is_owner_scoped(
    client, employee, admin, monkeypatch
):
    token = str(uuid.uuid4())
    original = main.provider.answer

    def answer(question, sources):
        value = ask_progress.read("employee", token)
        assert value["stage"] == "generating"
        assert str(len(sources)) in value["message"]
        return original(question, sources)

    monkeypatch.setattr(main.provider, "answer", answer)
    response = client.post(
        "/api/ask",
        headers={**employee, "X-Ask-Progress": token},
        json={"question": "How many days of annual leave?"},
    )
    assert response.status_code == 201
    path = f"/api/ask-progress/{token}"
    assert client.get(path, headers=employee).json()["stage"] == "complete"
    assert client.get(path, headers=admin).status_code == 404
    assert client.get(path).status_code == 401
    assert "annual leave" not in client.get(path, headers=employee).text


def test_failed_generation_reports_failure_without_source_or_error_leak(
    client, employee, monkeypatch
):
    token = str(uuid.uuid4())

    def failed(*args):
        raise ProviderUnavailable("private upstream detail")

    monkeypatch.setattr(main.provider, "answer", failed)
    response = client.post(
        "/api/ask",
        headers={**employee, "X-Ask-Progress": token},
        json={"question": "How many days of annual leave?"},
    )
    assert response.status_code == 503
    progress = client.get(f"/api/ask-progress/{token}", headers=employee)
    assert progress.json()["stage"] == "failed"
    assert "private upstream" not in progress.text
