"""Optional, repeatable synthetic Phase 3 cases. Existing execution is never overwritten."""

from sqlalchemy import select

from .cases import new_case
from .db import SessionLocal
from .models import Case, DocumentChunk, DocumentVersion, User, WorkflowDefinition
from .workflow_contracts import CaseCreate
from .workflows import start_workflow

SCENARIOS = [
    ("Annual Leave Review", ["leave-policy"]),
    ("Supporting Evidence Request", []),
    ("Access Review Clarification", ["access-sop", "access-review-policy"]),
]


def seed_workflow_demo(db, *, commit=True):
    user = db.get(User, "employee")
    definition = db.get(WorkflowDefinition, "generic-review-v1")
    if not user or not definition:
        raise ValueError("Run migrations and knowledge seed first.")
    legacy_titles = {
        "Annual Leave Review": "Demo A — Annual leave review",
        "Supporting Evidence Request": "Demo B — Missing supporting evidence",
        "Access Review Clarification": "Demo C — Access review conflict",
    }
    created = 0
    for title, source_ids in SCENARIOS:
        if db.scalar(
            select(Case).where(
                Case.title.in_([title, legacy_titles[title]]), Case.created_by == user.id
            )
        ):
            continue
        chunks = (
            list(
                db.scalars(
                    select(DocumentChunk.id)
                    .join(DocumentVersion)
                    .where(
                        DocumentVersion.document_id.in_(source_ids),
                        DocumentVersion.status == "active",
                    )
                    .order_by(DocumentVersion.document_id, DocumentChunk.ordinal)
                )
            )
            if source_ids
            else []
        )
        case = new_case(
            db,
            user,
            CaseCreate(
                title=title,
                description="Review the supporting sources and record an independent decision.",
                chunk_ids=chunks,
            ),
        )
        case.revision += 1
        start_workflow(db, user, case, definition)
        created += 1
    if commit:
        db.commit()
    return created


def main():
    with SessionLocal() as db:
        print(f"Workflow demo: {seed_workflow_demo(db)} synthetic cases created.")


if __name__ == "__main__":
    main()
