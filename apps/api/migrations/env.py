import sys
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from superflow import models  # noqa: E402,F401
from superflow.config import settings  # noqa: E402
from superflow.db import Base  # noqa: E402

config = context.config
url = config.get_main_option("sqlalchemy.url") or settings.database_url
target_metadata = Base.metadata

if context.is_offline_mode():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
