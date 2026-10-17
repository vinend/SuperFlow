import io
import math
from copy import deepcopy
from datetime import date

import pytest
from reportlab.pdfgen.canvas import Canvas
from sqlalchemy import func, select

from superflow import embeddings, ojk
from superflow.config import settings
from superflow.knowledge import add_version, index_chunks
from superflow.models import Document, DocumentVersion, User
from superflow.parsing import ParsedChunk
from superflow.retrieval import HybridRetriever
from superflow.schemas import AskInput, VersionInput
from superflow.workspace_intent import WorkspaceKind, deterministic_intent


def pdf(text="Bank wajib menerapkan dua faktor autentikasi."):
    output = io.BytesIO()
    canvas = Canvas(output)
    canvas.drawString(40, 780, "Pasal 5")
    canvas.drawString(40, 740, text)
    canvas.save()
    return output.getvalue()


SOURCE = {
    "source_url": "https://ojk.go.id/id/regulasi/official-test.pdf",
    "title": "OJK official test regulation",
    "kind": "regulation",
    "effective_date": "2023-12-22",
}


@pytest.mark.parametrize(
    "url",
    [
        "http://ojk.go.id/test.pdf",
        "https://ojk.go.id.evil.com/a.pdf",
        "https://127.0.0.1/a.pdf",
        "https://user:pass@ojk.go.id/a.pdf",
        "https://ojk.go.id:8000/a.pdf",
    ],
)
def test_official_downloader_rejects_other_origins(url):
    with pytest.raises(ojk.HTTPException):
        ojk.official_url(url)


def test_import_is_idempotent_and_retains_original_and_permission(db, client, admin, monkeypatch):
    original = pdf()
    monkeypatch.setattr(ojk, "download_pdf", lambda _: (SOURCE["source_url"], original))
    body = {"url": SOURCE["source_url"], "title": SOURCE["title"]}
    before = db.scalar(select(func.count()).select_from(Document))
    response = client.post("/api/ojk/import", headers=admin, json=body)
    assert response.status_code == 200
    document = response.json()
    version = document["versions"][0]
    assert version["source_provenance"]["legal_status"] == "unverified-reference"
    assert version["source_provenance"]["chunker"] == "llamaindex"
    assert "Pasal 5" in version["chunks"][0]["section_path"]
    again = client.post("/api/ojk/import", headers=admin, json=body)
    assert again.json()["id"] == document["id"]
    assert db.scalar(select(func.count()).select_from(Document)) == before + 1
    original_url = f"/api/documents/{document['id']}/versions/{version['id']}/file"
    assert client.get(original_url, headers=admin).content == original
    db.get(Document, document["id"]).access_roles = ["governance"]
    db.commit()
    assert client.get(original_url, headers={"X-User-Id": "employee"}).status_code == 404


def test_changed_official_bytes_add_new_version_without_replacing_old(db):
    user = db.get(User, "governance")
    first = ojk.ingest(db, user, deepcopy(SOURCE), pdf(), SOURCE["source_url"])
    db.commit()
    original_id = first.versions[0].id
    second = ojk.ingest(
        db,
        user,
        deepcopy(SOURCE),
        pdf("Bank wajib melindungi data konsumen."),
        SOURCE["source_url"],
    )
    db.commit()
    assert len(second.versions) == 2
    assert db.get(DocumentVersion, original_id).status == "outdated"
    assert sum(v.status == "active" for v in second.versions) == 1


def test_import_and_google_search_are_role_gated_before_network(client, employee, monkeypatch):
    def forbidden(*a, **k):
        pytest.fail("Unauthorized actor reached external network")

    monkeypatch.setattr(ojk, "download_pdf", forbidden)
    monkeypatch.setattr(ojk.subprocess, "run", forbidden)
    assert (
        client.post(
            "/api/ojk/import",
            headers=employee,
            json={"url": SOURCE["source_url"], "title": SOURCE["title"]},
        ).status_code
        == 403
    )
    assert (
        client.post("/api/ojk/search", headers=employee, json={"query": "OJK digital"}).status_code
        == 403
    )


def test_google_block_is_visible_without_invented_results(client, admin, monkeypatch):
    class Failed:
        returncode = 1

    monkeypatch.setattr(ojk.subprocess, "run", lambda *a, **k: Failed())
    result = client.post("/api/ojk/search", headers=admin, json={"query": "OJK digital"})
    assert result.status_code == 503
    assert "fabricated" in result.json()["detail"]


def test_llamaindex_uses_real_node_ids_and_authorized_persisted_vectors(db, monkeypatch):
    class Vectors:
        model = "test-vector-provider"

        def documents(self, texts):
            return [[1.0, 0.0] for _ in texts]

        def query(self, text):
            return [1.0, 0.0]

    monkeypatch.setattr(embeddings, "embedding_provider", lambda: Vectors())
    monkeypatch.setattr(settings, "retrieval_provider", "hybrid")
    monkeypatch.setattr(settings, "retrieval_engine", "llamaindex")
    user = db.get(User, "governance")
    document = ojk.ingest(db, user, deepcopy(SOURCE), pdf(), SOURCE["source_url"])
    db.commit()
    hits = HybridRetriever().retrieve(
        db, user, AskInput(question="dua faktor autentikasi", document_ids=[document.id])
    )
    assert hits and hits[0].chunk_id in {c.id for v in document.versions for c in v.chunks}
    document.access_roles = ["governance"]
    db.commit()
    assert (
        HybridRetriever().retrieve(
            db,
            db.get(User, "employee"),
            AskInput(question="dua faktor autentikasi", document_ids=[document.id]),
        )
        == []
    )


def test_ojk_question_selects_regulatory_answer_card_without_changing_tabs():
    value = deterministic_intent("Apa persyaratan autentikasi dalam POJK 21 Tahun 2023?")
    assert value.intent == WorkspaceKind.KNOWLEDGE_QA
    assert value.view == "regulation_brief"


def test_exact_article_outside_dense_top40_remains_eligible(db, monkeypatch):
    class Vectors:
        model = "article-regression-vectors"

        def documents(self, texts):
            return [
                [0.45, math.sqrt(1 - 0.45**2)] if "autentikasi" in text else [1.0, 0.0]
                for text in texts
            ]

        def query(self, text):
            return [1.0, 0.0]

    monkeypatch.setattr(embeddings, "embedding_provider", lambda: Vectors())
    monkeypatch.setattr(settings, "retrieval_provider", "keyword")
    monkeypatch.setattr(settings, "retrieval_engine", "llamaindex")
    monkeypatch.setattr(settings, "semantic_min_score", 0.3)
    document = Document(
        id="article-ranking",
        title="Official legal reference",
        domain="Compliance",
        owner_id="governance",
        authority_level=2,
        access_roles=["employee", "governance"],
        related_document_ids=[],
    )
    db.add(document)
    db.flush()
    version = add_version(
        db,
        document,
        VersionInput(version="1", effective_date=date.today()),
        "reference.txt",
        b"Original text",
    )
    index_chunks(
        version,
        [
            ParsedChunk(f"Section {i}", "General banking requirements and operational guidance.")
            for i in range(80)
        ]
        + [ParsedChunk("Pasal 9", "Bank wajib menerapkan dua faktor autentikasi.")],
    )
    embeddings.index_embeddings(version.chunks)
    db.commit()
    hits = HybridRetriever().retrieve(
        db,
        db.get(User, "employee"),
        AskInput(question="dua faktor autentikasi", document_ids=[document.id]),
    )
    assert hits[0].chunk_id == version.chunks[-1].id


def test_rag_status_and_index_recheck_permissions(client, employee, admin):
    assert client.get("/api/rag/status", headers=employee).status_code == 403
    status = client.get("/api/rag/status", headers=admin)
    assert status.status_code == 200
    assert status.json()["documents"]
    assert (
        client.post(
            "/api/rag/index", headers=employee, json={"document_id": "leave-policy"}
        ).status_code
        == 403
    )
