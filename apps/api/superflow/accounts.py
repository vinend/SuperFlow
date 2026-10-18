"""Operator-only account provisioning; passwords are read from the terminal."""

import argparse
from getpass import getpass

from sqlalchemy import select

from .db import SessionLocal
from .models import Role, User, identifier
from .password_auth import set_password


def main():
    parser = argparse.ArgumentParser(description="Provision or reset a named PostgreSQL account.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name")
    parser.add_argument(
        "--role", choices=["employee", "manager", "sme", "compliance", "finance", "governance"]
    )
    parser.add_argument("--department")
    args = parser.parse_args()
    password = getpass("Password (15–128 characters): ")
    if password != getpass("Confirm password: "):
        parser.error("Passwords do not match.")
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.email == args.email.strip().lower()))
        if not user:
            if not args.name or not args.role or not db.get(Role, args.role):
                parser.error("New accounts need --name and an installed --role.")
            user = User(
                id=identifier(),
                email=args.email.strip().lower(),
                name=args.name,
                role_id=args.role,
                department=args.department or args.role.title(),
                active=True,
            )
            db.add(user)
            db.flush()
        elif args.role and args.role != user.role_id:
            parser.error("Role changes require a separate administrator-reviewed database change.")
        set_password(db, user, password)
        print(f"Account provisioned: {user.email}; role={user.role_id}; user_id={user.id}")


if __name__ == "__main__":
    main()
