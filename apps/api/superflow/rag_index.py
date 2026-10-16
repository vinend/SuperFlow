"""Operator command to backfill vectors without changing text or saved citation IDs."""

import argparse

from sqlalchemy import select

from .audit import record
from .auth import require_manage
from .db import SessionLocal
from .embeddings import index_embeddings
from .knowledge import accessible_document
from .models import Document, User


def main():
    parser = argparse.ArgumentParser(
        description="Index stored SuperFlow chunks using a local model."
    )
    parser.add_argument("--user", default="governance")
    parser.add_argument("--document")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        user = db.get(User, args.user)
        if user is None or not user.active:
            parser.error("Choose an active knowledge maintainer.")
        require_manage(user)
        ids = [args.document] if args.document else list(db.scalars(select(Document.id)))
        count = 0
        for document_id in ids:
            # One document transaction bounds lock duration; a failed document is rolled
            # back by Session.close and the command exits unsuccessfully for a safe retry.
            document = accessible_document(db, user, document_id, lock=True)
            indexed = index_embeddings(
                [chunk for version in document.versions for chunk in version.chunks],
                force=args.force,
            )
            count += indexed
            record(
                db,
                user,
                document.id,
                "document_embeddings_indexed",
                entity_type="document",
                indexed_chunks=indexed,
            )
            db.commit()
            print(f"Indexed document {document.id}.", flush=True)
        print(f"Semantic index ready: {count} chunk vectors added/updated.")


if __name__ == "__main__":
    main()
