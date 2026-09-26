import pytest
from sqlalchemy import func, select

from superflow.models import Document, DocumentVersion, QuestionRun
from superflow.seed import reset_synthetic, validate_reset_target


def test_reset_failure_rolls_back_existing_data(db, monkeypatch):
    import superflow.seed as seed_module

    def fail_seed(*args, **kwargs):
        raise RuntimeError("Synthetic fixture failure")

    monkeypatch.setattr(seed_module, "seed", fail_seed)
    with pytest.raises(RuntimeError):
        reset_synthetic(db)
    assert db.scalar(select(func.count()).select_from(Document)) == 13
    assert db.get(Document, "leave-policy").title == "Annual Leave Policy"


def test_reset_restores_seed_and_removes_question_runs(client, employee, db):
    client.post("/api/ask", headers=employee, json={"question": "annual leave days"})
    document = db.get(Document, "leave-policy")
    document.title = "User-edited synthetic title"
    db.commit()
    assert reset_synthetic(db) == 13
    db.expire_all()
    assert db.get(Document, "leave-policy").title == "Annual Leave Policy"
    assert db.scalar(select(func.count()).select_from(DocumentVersion)) == 15
    assert db.scalar(select(func.count()).select_from(QuestionRun)) == 0


@pytest.mark.parametrize(
    "url,confirmed",
    [
        ("postgresql://localhost/superflow", False),
        ("postgresql://remote.example/superflow", True),
        ("postgresql://localhost/production", True),
        ("sqlite:///demo.db", True),
    ],
)
def test_reset_refuses_unconfirmed_or_unapproved_targets(url, confirmed):
    with pytest.raises(ValueError):
        validate_reset_target(url, confirmed)


def test_reset_accepts_only_confirmed_local_demo_databases():
    validate_reset_target("postgresql+psycopg://localhost/superflow", True)
    validate_reset_target("postgresql+psycopg://127.0.0.1/superflow_test", True)
