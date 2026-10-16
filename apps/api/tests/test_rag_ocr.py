import io
import json
import os

import pytest
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas
from sqlalchemy import func, select

from superflow import embeddings, main, parsing
from superflow.config import settings
from superflow.models import ChunkEmbedding, Document, DocumentChunk, DocumentVersion, QuestionRun
from superflow.ocr import OcrText, OcrUnavailable
from superflow.parsing import ParseError, parse_file
from superflow.retrieval import HybridRetriever, KeywordConceptRetriever
from superflow.schemas import AskInput


def image_bytes():
    image = Image.new("RGB", (1500, 450), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=42)
    draw.text((50, 80), "Travel reimbursement requires manager approval.", font=font, fill="black")
    draw.text((50, 160), "Submit the receipt within 30 days.", font=font, fill="black")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def scanned_pdf(*, native_first=False, pages=1):
    buffer = io.BytesIO()
    canvas = Canvas(buffer, pagesize=(750, 300))
    if native_first:
        canvas.drawString(30, 250, "Digital source: annual leave is fifteen days.")
        canvas.showPage()
    for _ in range(pages):
        canvas.drawImage(ImageReader(io.BytesIO(image_bytes())), 0, 30, width=750, height=225)
        canvas.showPage()
    canvas.save()
    return buffer.getvalue()


def test_mixed_pdf_keeps_page_identity_and_ocr_provenance(monkeypatch):
    calls = []

    def ocr(data, page):
        calls.append(page)
        return OcrText("Travel reimbursement requires manager approval.", 0.91)

    monkeypatch.setattr(parsing, "recognize_pdf_page", ocr)
    _, chunks = parse_file("mixed.pdf", scanned_pdf(native_first=True))
    assert calls == [1]
    assert chunks[0].page_number == 1 and chunks[0].extraction_method == "pdf_text"
    assert chunks[1].page_number == 2 and chunks[1].section == "Page 2"
    assert chunks[1].extraction_method == "ocr" and chunks[1].ocr_confidence == 0.91


def test_ocr_failure_rejects_entire_pdf_instead_of_silently_losing_a_page(monkeypatch):
    def failed(*args):
        raise OcrUnavailable("OCR runtime unavailable")

    monkeypatch.setattr(parsing, "recognize_pdf_page", failed)
    with pytest.raises(ParseError, match="OCR runtime unavailable"):
        parse_file("mixed.pdf", scanned_pdf(native_first=True))


def test_ocr_and_pdf_page_limits_are_enforced(monkeypatch):
    monkeypatch.setattr(settings, "ocr_max_pages", 1)
    monkeypatch.setattr(parsing, "recognize_pdf_page", lambda *_: OcrText("Readable text", 0.9))
    with pytest.raises(ParseError, match="OCR limit"):
        parse_file("long-scan.pdf", scanned_pdf(pages=2))
    monkeypatch.setattr(settings, "pdf_max_pages", 1)
    with pytest.raises(ParseError, match="parsing limit"):
        parse_file("long.pdf", scanned_pdf(pages=2))


def test_long_chunks_overlap_without_crossing_page_or_exceeding_size():
    _, chunks = parse_file("long.txt", ("context " * 600).encode())
    assert len(chunks) > 2
    assert all(len(chunk.text) <= 1200 for chunk in chunks)
    assert chunks[0].text.split()[-10:] == chunks[1].text.split()[:10]


def test_ocr_upload_preserves_original_and_requires_human_review(client, admin, monkeypatch):
    monkeypatch.setattr(
        parsing,
        "recognize",
        lambda _: OcrText("Travel reimbursement requires manager approval.", 0.84),
    )
    raw = image_bytes()
    response = client.post(
        "/api/documents",
        headers=admin,
        data={
            "metadata": json.dumps(
                {
                    "title": "Scanned travel policy",
                    "domain": "People",
                    "owner_id": "governance",
                    "authority_level": 5,
                    "access_roles": ["governance"],
                    "related_document_ids": [],
                }
            ),
            "effective_date": "2026-01-01",
        },
        files={"file": ("scan.png", raw, "image/png")},
    )
    assert response.status_code == 201, response.text
    document = response.json()
    answer = client.post(
        "/api/ask",
        headers=admin,
        json={
            "question": "Travel reimbursement manager approval",
            "document_ids": [document["id"]],
        },
    ).json()
    source = answer["sources"][0]
    assert source["extraction_method"] == "ocr" and source["ocr_confidence"] == 0.84
    assert source["page_number"] == 1
    assert answer["reliability"]["status"] == "REVIEW_REQUIRED"
    assert "OCR" in answer["reliability"]["checks"]["human_review_requirement"]["details"]
    version_id = document["versions"][0]["id"]
    downloaded = client.get(
        f"/api/documents/{document['id']}/versions/{version_id}/file", headers=admin
    )
    assert downloaded.content == raw


class TestEmbedding:
    model = "test-embedding-v1"

    def documents(self, texts):
        return [[1.0, 0.0] if "annual leave" in text.lower() else [0.0, 1.0] for text in texts]

    def query(self, text):
        return [1.0, 0.0]


@pytest.fixture
def vectors(db, monkeypatch):
    provider = TestEmbedding()
    monkeypatch.setattr(embeddings, "embedding_provider", lambda: provider)
    chunks = list(db.scalars(select(DocumentChunk)))
    assert embeddings.index_embeddings(chunks) == len(chunks)
    db.flush()
    return provider


def test_semantic_retrieval_finds_a_paraphrase_and_keeps_version_filter(db, vectors):
    from superflow.models import User

    user = db.get(User, "employee")
    query = AskInput(question="Recharging my batteries", document_ids=["leave-policy"])
    assert KeywordConceptRetriever().retrieve(db, user, query) == []
    hits = HybridRetriever().retrieve(db, user, query)
    assert hits
    assert all(
        db.get(DocumentVersion, db.get(DocumentChunk, hit.chunk_id).version_id).status == "active"
        for hit in hits
    )
    historical = HybridRetriever().retrieve(
        db, user, query.model_copy(update={"include_outdated": True})
    )
    assert any(
        db.get(DocumentVersion, db.get(DocumentChunk, hit.chunk_id).version_id).status == "outdated"
        for hit in historical
    )


def test_restricted_filter_does_not_call_model_or_require_restricted_vectors(db, vectors):
    from superflow.models import User

    def forbidden(*args):
        raise AssertionError("A denied source must not reach the embedding provider")

    vectors.query = forbidden
    assert (
        HybridRetriever().retrieve(
            db,
            db.get(User, "employee"),
            AskInput(question="Proposal A investment", document_ids=["proposal-a"]),
        )
        == []
    )


def test_index_is_persistent_idempotent_and_detects_changed_content(db, vectors):
    from superflow.models import User

    chunks = list(db.scalars(select(DocumentChunk)))
    before = {chunk.id for chunk in chunks}
    assert embeddings.index_embeddings(chunks) == 0
    db.flush()
    assert db.scalar(select(func.count()).select_from(ChunkEmbedding)) == len(chunks)
    chunk = next(
        chunk
        for chunk in chunks
        if "annual leave" in chunk.text.lower()
        and db.get(DocumentVersion, chunk.version_id).status == "active"
    )
    chunk.text += " Changed source."
    with pytest.raises(embeddings.EmbeddingUnavailable, match="stale"):
        HybridRetriever().retrieve(db, db.get(User, "governance"), AskInput(question="leave"))
    assert embeddings.index_embeddings(chunks) == 1
    assert {chunk.id for chunk in chunks} == before


def test_hybrid_rechecks_permissions_after_indexing(db, vectors):
    from superflow.models import User

    document = db.get(Document, "leave-policy")
    document.access_roles = ["governance"]
    db.flush()
    assert (
        HybridRetriever().retrieve(
            db,
            db.get(User, "employee"),
            AskInput(question="Recharging my batteries", document_ids=["leave-policy"]),
        )
        == []
    )


def test_missing_index_returns_503_without_persisting_a_partial_answer(
    client, admin, db, monkeypatch
):
    monkeypatch.setattr(main, "retriever", HybridRetriever())
    monkeypatch.setattr(embeddings, "embedding_provider", TestEmbedding)
    count = db.scalar(select(func.count()).select_from(QuestionRun))
    response = client.post("/api/ask", headers=admin, json={"question": "Annual leave"})
    assert response.status_code == 503 and "index" in response.json()["detail"]
    assert db.scalar(select(func.count()).select_from(QuestionRun)) == count


def test_embedding_failure_rolls_back_upload_and_version_publication(
    client, admin, db, monkeypatch
):
    def failed(*args):
        raise embeddings.EmbeddingUnavailable("Embedding runtime unavailable")

    monkeypatch.setattr(settings, "retrieval_provider", "hybrid")
    monkeypatch.setattr(embeddings, "embedding_provider", TestEmbedding)
    monkeypatch.setattr(TestEmbedding, "documents", failed)
    count = db.scalar(select(func.count()).select_from(Document))
    response = client.post(
        "/api/documents",
        headers=admin,
        data={
            "metadata": json.dumps(
                {
                    "title": "Atomic upload",
                    "domain": "People",
                    "owner_id": "governance",
                    "authority_level": 5,
                    "access_roles": ["governance"],
                    "related_document_ids": [],
                }
            )
        },
        files={"file": ("policy.txt", b"Updated training policy.", "text/plain")},
    )
    assert response.status_code == 503
    assert db.scalar(select(func.count()).select_from(Document)) == count
    response = client.post(
        "/api/documents/leave-policy/versions",
        headers=admin,
        data={"version": "3.0", "effective_date": "2026-01-01"},
        files={"file": ("new.txt", b"Updated leave policy.", "text/plain")},
    )
    assert response.status_code == 503
    document = db.get(Document, "leave-policy")
    assert len(document.versions) == 2
    assert (
        next(version for version in document.versions if version.status == "active").version
        == "2.0"
    )


def test_reindex_rejects_changed_text_even_when_chunk_count_matches(client, admin, db, monkeypatch):
    from dataclasses import replace

    original = main.parse_file
    before = {chunk.id: chunk.text for chunk in db.scalars(select(DocumentChunk))}

    def changed(*args):
        media, chunks = original(*args)
        chunks[0] = replace(chunks[0], text=chunks[0].text + " Parser changed text.")
        return media, chunks

    monkeypatch.setattr(main, "parse_file", changed)
    response = client.post("/api/documents/leave-policy/index", headers=admin)
    assert response.status_code == 409
    assert {chunk.id: chunk.text for chunk in db.scalars(select(DocumentChunk))} == before


@pytest.mark.skipif(
    os.getenv("SUPERFLOW_TEST_LOCAL_MODELS") != "1",
    reason="Opt-in real local OCR/embedding inference",
)
def test_real_ocr_reads_an_image_only_pdf():
    _, chunks = parse_file("scan.pdf", scanned_pdf())
    text = " ".join(chunk.text for chunk in chunks).lower()
    assert "manager approval" in text and "30 days" in text
    assert all(chunk.extraction_method == "ocr" and chunk.ocr_confidence > 0.5 for chunk in chunks)


@pytest.mark.skipif(
    os.getenv("SUPERFLOW_TEST_LOCAL_MODELS") != "1",
    reason="Opt-in real local OCR/embedding inference",
)
def test_real_embeddings_rank_the_relevant_passage():
    provider = embeddings.FastEmbedProvider()
    passages = provider.documents(
        [
            "Employees receive fifteen days of annual leave each year.",
            "Vendor invoices must be submitted with purchase orders.",
        ]
    )
    query = provider.query("What paid time off do staff receive?")
    scores = [sum(a * b for a, b in zip(query, vector, strict=True)) for vector in passages]
    assert len(query) == 384 and scores[0] > scores[1]
