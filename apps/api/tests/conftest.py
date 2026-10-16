import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Functional tests have deterministic provider fixtures, independent of the local
# operator's RAG mode. Real-model checks opt in explicitly in test_rag_ocr.py.
os.environ["RETRIEVAL_PROVIDER"] = "keyword"

from superflow.audit import demo_reset_mode
from superflow.config import ROOT
from superflow.db import Base, get_db
from superflow.main import app
from superflow.seed import seed


@pytest.fixture(scope="session")
def test_engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if url:
        assert make_url(url).database.endswith("_test"), "Test DB name must end with _test."
        engine = create_engine(url)
        config = Config(str(ROOT / "apps/api/alembic.ini"))
        config.set_main_option("sqlalchemy.url", url)
        command.upgrade(config, "head")
    else:
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )

        @event.listens_for(engine, "connect")
        def sqlite_transaction_mode(connection, _):
            connection.isolation_level = None

        @event.listens_for(engine, "begin")
        def explicit_sqlite_begin(connection):
            connection.exec_driver_sql("BEGIN")

        Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
    )
    # Reset only inside an outer, rolled-back transaction. Existing E2E test data survives.
    demo_reset_mode(session, True)
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(delete(table))
    demo_reset_mode(session, False)
    seed(session)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def request_db():
        try:
            yield db
        finally:
            # Match get_db's close/rollback behavior for a failed request.
            if db.in_transaction():
                db.rollback()

    app.dependency_overrides[get_db] = request_db
    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin():
    return {"X-User-Id": "governance"}


@pytest.fixture
def employee():
    return {"X-User-Id": "employee"}
