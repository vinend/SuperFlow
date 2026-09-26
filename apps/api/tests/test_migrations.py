from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from superflow.config import ROOT


def test_migration_upgrade_downgrade_and_schema_match(tmp_path):
    url = f"sqlite:///{tmp_path / 'migration-test.db'}"
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    engine = create_engine(url)
    assert {
        "roles",
        "users",
        "documents",
        "document_versions",
        "document_chunks",
        "question_runs",
    } <= set(inspect(engine).get_table_names())
    command.check(config)
    command.downgrade(config, "base")
    assert inspect(engine).get_table_names() == ["alembic_version"]
    command.upgrade(config, "head")
    assert "document_chunks" in inspect(engine).get_table_names()
    engine.dispose()
