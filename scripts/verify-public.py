"""Real local-vector smoke check; run via scripts/python.mjs after demo:public."""

import json
from datetime import datetime, timezone

from sqlalchemy import func, select

from superflow.config import ROOT, settings
from superflow.db import SessionLocal
from superflow.embeddings import content_hash
from superflow.models import AuditEvent, Document, DocumentChunk, DocumentVersion, User
from superflow.retrieval import HybridRetriever
from superflow.schemas import AskInput

QUESTIONS = [
    (
        "Finance",
        "What is the difference between cash flow actuals and cash flow projections?",
    ),
    (
        "Operations",
        "How does incident response connect to cybersecurity risk management?",
    ),
    (
        "People",
        "How can managers support communication and worker well-being while teleworking?",
    ),
]


def main():
    with SessionLocal() as db:
        documents = list(
            db.scalars(select(Document).where(Document.context_run_id.is_(None)))
        )
        public = [
            document for document in documents if document.id.startswith("public-")
        ]
        assert len(public) == 6, "Import all six references before verification."
        chunks = [
            chunk
            for document in documents
            for version in document.versions
            for chunk in version.chunks
        ]
        ready = sum(
            any(
                row.model == settings.embedding_model
                and row.content_hash == content_hash(chunk)
                for row in chunk.embeddings
            )
            for chunk in chunks
        )
        assert ready == len(chunks), "The full shared knowledge index is incomplete."
        user = db.get(User, "employee")
        retriever = HybridRetriever()
        checks = []
        for domain, question in QUESTIONS:
            hits = retriever.retrieve(
                db, user, AskInput(question=question, domain=domain)
            )
            titles = []
            for hit in hits:
                chunk = db.get(DocumentChunk, hit.chunk_id)
                version = db.get(DocumentVersion, chunk.version_id)
                document = db.get(Document, version.document_id)
                titles.append(document.title)
            assert any(
                title in {document.title for document in public} for title in titles
            ), (domain, titles)
            checks.append(
                {"domain": domain, "question": question, "retrieved_titles": titles}
            )
        denied = retriever.retrieve(
            db,
            user,
            AskInput(
                question="Proposal A initial investment", document_ids=["proposal-a"]
            ),
        )
        assert not denied
        rebuilds = db.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.event_type == "knowledge_embeddings_rebuilt")
        )
        report = {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "embedding_model": settings.embedding_model,
            "shared_documents": len(documents),
            "shared_chunks": len(chunks),
            "ready_vectors": ready,
            "new_public_documents": len(public),
            "new_public_chunks": sum(
                len(version.chunks)
                for document in public
                for version in document.versions
            ),
            "rebuild_audit_events": rebuilds,
            "permission_denied_sources": len(denied),
            "retrieval_checks": checks,
        }
        path = ROOT / "data/public/verification.json"
        path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
