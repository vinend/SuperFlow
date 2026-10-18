"""Copy the clean local presentation dataset without changing the test database."""

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

from superflow.config import settings

source = make_url(settings.database_url)
if source.host not in {"127.0.0.1", "localhost", "::1"} or source.database != "superflow_test":
    raise SystemExit("Clone source must be the local superflow_test database.")

target = "superflow_final"
with psycopg.connect(
    host=source.host,
    port=source.port or 5432,
    dbname="postgres",
    user=source.username,
    password=source.password,
    autocommit=True,
) as connection:
    exists = connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target,)).fetchone()
    if exists:
        raise SystemExit(f"{target} already exists; refusing to replace data.")
    connection.execute(
        sql.SQL("CREATE DATABASE {} WITH TEMPLATE {} OWNER {}").format(
            sql.Identifier(target), sql.Identifier(source.database), sql.Identifier(source.username)
        )
    )
print(f"Created isolated local presentation database {target}.")
