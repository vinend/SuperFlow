import io
import json
from datetime import date

import pytest
from reportlab.pdfgen.canvas import Canvas
from sqlalchemy import func, select

from superflow import embeddings, public_sources
from superflow.knowledge import add_version
from superflow.models import AuditEvent, Document, DocumentChunk, QuestionRun, User
from superflow.schemas import VersionInput


def pdf(text="Public training guidance for cash flow and workplace planning."):
    output = io.BytesIO()
    canvas = Canvas(output)
    canvas.drawString(40, 750, text)
    canvas.save()
    return output.getvalue()


def upload(client, admin, data=None):
    return client.post(
        "/api/documents",
        headers=admin,
        data={
            "metadata": json.dumps(
                {
                    "title": "Public cash flow guide",
                    "domain": "Finance",
                    "owner_id": "governance",
                    "authority_level": 2,
                    "access_roles": ["governance", "finance"],
                }
            )
        },
        files={"file": ("guide.PDF", data or pdf(), "application/pdf")},
    )


def test_pdf_forces_all_existing_versions_and_restricted_vectors_without_rechunking(
    db,
    client,
    admin,
    monkeypatch,
):
    chunks = list(db.scalars(select(DocumentChunk)))
    original_ids = {chunk.id for chunk in chunks}
    embeddings.index_embeddings(chunks)
    db.commit()
    seen = []

    class ChangedModel:
        model = "functional-test-vectors"

        def documents(self, texts):
            seen.extend(texts)
            return [[0.0, 1.0] for _ in texts]

    monkeypatch.setattr(embeddings, "embedding_provider", ChangedModel)
    response = upload(client, admin)
    assert response.status_code == 201, response.text
    # Force refresh includes already valid vectors, historical versions and
    # restricted documents; none are exposed in the upload's response.
    assert len(seen) > len(chunks)
    assert all(chunk.embeddings[0].vector == [0.0, 1.0] for chunk in chunks)
    assert original_ids <= set(db.scalars(select(DocumentChunk.id)))
    assert "180,000,000" not in response.text
    assert (
        db.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.event_type == "knowledge_embeddings_rebuilt")
        )
        == 1
    )


def test_rebuild_excludes_private_websearch_snapshots(db):
    run = QuestionRun(
        user_id="finance",
        question="Private web scan",
        answer="",
        outcome="no_sources",
        filters={},
        source_refs=[],
        provider="test",
    )
    db.add(run)
    db.flush()
    private = Document(
        id="private-scan",
        title="Private context",
        domain="Finance",
        owner_id="finance",
        authority_level=1,
        access_roles=["finance"],
        context_run_id=run.id,
    )
    db.add(private)
    add_version(
        db,
        private,
        VersionInput(version="1", effective_date=date.today()),
        "scan.txt",
        b"Private web context.",
    )
    document = db.get(Document, "leave-policy")
    add_version(
        db, document, VersionInput(version="pdf", effective_date=date.today()), "new.pdf", pdf()
    )
    assert all(not chunk.embeddings for version in private.versions for chunk in version.chunks)


def test_failed_full_refresh_rolls_back_pdf_and_old_active_version(db, client, admin, monkeypatch):
    old_document = db.get(Document, "leave-policy")
    old_ids = {version.id for version in old_document.versions}
    old_active = next(v.id for v in old_document.versions if v.status == "active")
    chunks = list(db.scalars(select(DocumentChunk)))
    embeddings.index_embeddings(chunks)
    db.commit()

    class FailedModel:
        model = "functional-test-vectors"

        def documents(self, texts):
            raise embeddings.EmbeddingUnavailable("Test embedding failure")

    monkeypatch.setattr(embeddings, "embedding_provider", FailedModel)
    response = client.post(
        "/api/documents/leave-policy/versions",
        headers=admin,
        data={"version": "pdf", "effective_date": date.today().isoformat()},
        files={"file": ("new.pdf", pdf(), "application/pdf")},
    )
    assert response.status_code == 503
    db.expire_all()
    assert {v.id for v in old_document.versions} == old_ids
    assert next(v.id for v in old_document.versions if v.status == "active") == old_active
    assert all(c.embeddings[0].vector == [1.0, 0.0] for c in chunks)
    before = db.scalar(select(func.count()).select_from(Document))
    assert upload(client, admin).status_code == 503
    assert db.scalar(select(func.count()).select_from(Document)) == before


def test_invalid_pdf_does_not_trigger_rebuild(client, admin, monkeypatch):
    def forbidden(*args):
        pytest.fail("Invalid PDF reached embedding model")

    monkeypatch.setattr(embeddings, "embedding_provider", forbidden)
    assert upload(client, admin, b"invalid pdf").status_code == 422


def test_public_import_retains_division_source_and_is_idempotent(db):
    source = {
        "title": "NIST public operations guide",
        "domain": "Operations",
        "publisher": "NIST",
        "jurisdiction": "United States; voluntary reference",
        "kind": "public-technical-guidance",
        "retrieved_at": "2026-10-18T00:00:00Z",
    }
    url = "https://nvlpubs.nist.gov/test.pdf"
    data = pdf()
    user = db.get(User, "governance")
    document = public_sources.ingest(db, user, source, data, url)
    db.commit()
    assert public_sources.ingest(db, user, source, data, url).id == document.id
    assert len(document.versions) == 1 and document.domain == "Operations"
    provenance = document.versions[0].source_provenance
    assert (
        provenance["publisher"] == "NIST" and provenance["jurisdiction"] == source["jurisdiction"]
    )
    assert provenance["legal_status"] == "unverified-reference"


def test_public_redirect_and_cached_url_keep_the_same_document(db):
    source = {
        "title": "Public cash flow guide",
        "domain": "Finance",
        "publisher": "CFPB",
        "jurisdiction": "US educational reference",
        "kind": "public-training-tool",
        "retrieved_at": "2026-10-18T00:00:00Z",
        "source_url": "https://www.consumerfinance.gov/documents/guide.pdf",
    }
    user = db.get(User, "governance")
    data = pdf()
    first = public_sources.ingest(
        db, user, source, data, "https://files.consumerfinance.gov/guide.pdf"
    )
    db.commit()
    cached = public_sources.ingest(db, user, source, data, source["source_url"])
    assert cached.id == first.id and len(cached.versions) == 1


@pytest.mark.parametrize(
    "url",
    [
        "http://nvlpubs.nist.gov/a.pdf",
        "https://localhost/a.pdf",
        "https://nvlpubs.nist.gov.evil.com/a.pdf",
        "https://user@www.ilo.org/a.pdf",
    ],
)
def test_public_download_rejects_unapproved_origins(url):
    with pytest.raises(ValueError):
        public_sources.public_url(url)
