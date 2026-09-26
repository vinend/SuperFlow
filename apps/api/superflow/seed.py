import argparse
import json
from datetime import date

from sqlalchemy import delete
from sqlalchemy.engine import make_url

from .config import ROOT, settings
from .db import Base, SessionLocal
from .knowledge import add_version
from .models import Document, Role, User
from .schemas import VersionInput

ROLES = [
    ("employee", "Employee", "People", "Maya Putri"),
    ("manager", "Manager / Approver", "Operations", "Arif Santoso"),
    ("sme", "Subject Matter Expert", "Knowledge", "Nadia Rahman"),
    ("compliance", "Compliance User", "Compliance", "Raka Wijaya"),
    ("finance", "Finance User", "Finance", "Dina Sari"),
    ("governance", "Governance Administrator", "Governance", "Alex Pratama"),
]


def seed(db, *, commit=True):
    for role_id, name, department, user_name in ROLES:
        if db.get(Role, role_id) is None:
            permissions = ["knowledge:read", "knowledge:ask"]
            if role_id in {"governance", "sme"}:
                permissions.append("knowledge:write")
            db.add(Role(id=role_id, name=name, permissions=permissions))
    db.flush()
    for role_id, _, department, user_name in ROLES:
        if db.get(User, role_id) is None:
            db.add(
                User(
                    id=role_id,
                    name=user_name,
                    email=f"{role_id}@superflow.example",
                    department=department,
                    role_id=role_id,
                    active=True,
                )
            )
    db.flush()
    directory = ROOT / "data" / "seed"
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    created = 0
    for entry in manifest:
        # Non-destructive and idempotent: never overwrite user-edited metadata or versions.
        if db.get(Document, entry["id"]) is not None:
            continue
        document = Document(**{key: value for key, value in entry.items() if key != "versions"})
        db.add(document)
        db.flush()
        for item in entry["versions"]:
            source = directory / item["file"]
            add_version(
                db,
                document,
                VersionInput(
                    version=item["version"],
                    status=item["status"],
                    effective_date=date.fromisoformat(item["effective_date"]),
                ),
                source.name,
                source.read_bytes(),
            )
        created += 1
    if commit:
        db.commit()
    return created


def validate_reset_target(url: str, confirmed: bool) -> None:
    target = make_url(url)
    if not confirmed:
        raise ValueError(
            "Reset requires --confirm-synthetic-data. Uploads and questions will be deleted."
        )
    if (
        target.get_backend_name() != "postgresql"
        or target.host not in {"127.0.0.1", "localhost", "::1"}
        or target.database not in {"superflow", "superflow_test"}
    ):
        raise ValueError(
            "Reset is limited to local PostgreSQL databases superflow or superflow_test."
        )


def reset_synthetic(db):
    """Reset only the Phase 0/1 tables in a single transaction; preserve the schema."""
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(delete(table))
        db.expunge_all()
        count = seed(db, commit=False)
        db.commit()
        return count
    except Exception:
        db.rollback()
        raise


def main():
    parser = argparse.ArgumentParser(description="Seed synthetic Phase 0/1 knowledge data.")
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--confirm-synthetic-data", action="store_true")
    args = parser.parse_args()
    if args.reset:
        try:
            validate_reset_target(settings.database_url, args.confirm_synthetic_data)
        except ValueError as error:
            parser.error(str(error))
    with SessionLocal() as session:
        count = reset_synthetic(session) if args.reset else seed(session)
        print(f"{'Reset' if args.reset else 'Seed'} complete: {count} synthetic documents created.")


if __name__ == "__main__":
    main()
