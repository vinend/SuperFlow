"""Read-only inventory of locally generated recording fixtures."""

from collections import Counter

from sqlalchemy import func, select

from superflow.db import SessionLocal
from superflow.models import ChunkEmbedding, Document, QuestionRun

with SessionLocal() as db:
    print(
        "Totals",
        "documents", db.scalar(select(func.count()).select_from(Document)),
        "vectors", db.scalar(select(func.count()).select_from(ChunkEmbedding)),
        "questions", db.scalar(select(func.count()).select_from(QuestionRun)),
    )
    for title in ["Scanned travel reimbursement policy", "Example Domain website reference"]:
        documents = db.scalars(select(Document).where(Document.title == title)).all()
        print(title, len(documents))
        for document in documents:
            print(" ", document.id, document.created_at, document.owner_id, document.domain)
    counts = Counter(run.question for run in db.scalars(select(QuestionRun)).all())
    print("Question counts")
    for question, count in counts.most_common(15):
        print(" ", count, question[:110])
