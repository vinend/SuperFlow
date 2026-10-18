"""Install password fixtures exclusively in a PostgreSQL *_test database."""

from sqlalchemy.engine import make_url

from superflow.config import settings
from superflow.db import SessionLocal
from superflow.models import User
from superflow.password_auth import set_password
from superflow.seed import seed

if not make_url(settings.database_url).database.endswith("_test"):
    raise RuntimeError("Password browser fixtures require a *_test database.")
with SessionLocal.begin() as db:
    seed(db, commit=False)
    for user_id in ("finance", "compliance"):
        set_password(db, db.get(User, user_id), "staging browser test password 2026")
print("Password browser fixtures ready in test database.")
