from contextlib import contextmanager
from copy import deepcopy

from fastapi import HTTPException
from sqlalchemy import func, select

from superflow import main, web_search
from superflow.models import Document, QuestionRun, User
from superflow.retrieval import KeywordConceptRetriever
from superflow.schemas import AskInput


def capture():
    return {
        "url": "https://public.example/reference",
        "requested_url": "https://public.example/reference",
        "title": "Public leave reference",
        "text": "Public annual leave guidance says fifteen days. Always check the employer policy.",
        "captured_at": "2026-10-18T00:00:00Z",
        "text_truncated": False,
        "coverage": "One viewport",
        "vision_model": "fixture-local-vision",
        "screenshots": [{"y": 0, "image": "dGVzdA==", "sha256": "a" * 64}],
        "observations": [
            {
                "screenshot": 1,
                "visible_text": "Leave chart",
                "visual_description": "A leave chart with fifteen days",
                "limitations": "A chart is unverified",
            }
        ],
    }


def test_google_vision_pages_enter_real_ask_context_without_polluting_kb(client, db, monkeypatch):
    scans = []

    def scan(url, **kwargs):
        scans.append((url, kwargs))
        result = deepcopy(capture())
        if kwargs.get("search_query"):
            result["url"] = "https://www.google.com/search?q=leave"
            result["results"] = [{"url": capture()["url"], "title": capture()["title"]}]
        return result

    monkeypatch.setattr(web_search, "scan_website", scan)
    received = []

    class InspectingProvider:
        name = "ollama-fixture"

        def answer(self, question, sources):
            received.extend(sources)
            native = next(s for s in sources if s["source_origin"] == "knowledge_base")
            visual = next(s for s in sources if s["extraction_method"] == "vision")
            return (
                f"Local policy: fifteen days. [{native['citation_id']}]\n\n"
                f"The unverified visual scan shows a leave chart. [{visual['citation_id']}]"
            )

    monkeypatch.setattr(main, "provider", InspectingProvider())
    response = client.post(
        "/api/ask",
        headers={"X-User-Id": "employee"},
        json={
            "question": "annual leave days",
            "web_search": True,
            "web_query": "public annual leave guidance",
        },
    )
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["web_search"]["status"] == "complete"
    assert result["web_search"]["sources_read"] == 1
    assert scans[0][1]["search_query"] == "public annual leave guidance"
    assert len(scans) == 2
    assert any(s["extraction_method"] == "vision" for s in received)
    assert any(s["extraction_method"] == "web_capture" for s in received)
    assert result["reliability"]["status"] == "REVIEW_REQUIRED"
    external = [s for s in result["sources"] if s["source_origin"] == "internet"]
    assert len(external) == 2
    assert all(s["vision_model"] == "fixture-local-vision" for s in external)
    ids = {s["document_id"] for s in external}
    inventory = client.get("/api/documents", headers={"X-User-Id": "employee"}).json()
    assert not ids.intersection(d["id"] for d in inventory)
    for doc_id in ids:
        document = db.get(Document, doc_id)
        assert document.context_run_id == result["id"]
        assert not any(
            chunk.embeddings for version in document.versions for chunk in version.chunks
        )
        for actor in ["finance", "governance"]:
            assert (
                client.get(f"/api/documents/{doc_id}", headers={"X-User-Id": actor}).status_code
                == 404
            )
    query = AskInput(question="annual leave days")
    hits = KeywordConceptRetriever().retrieve(db, db.get(User, "employee"), query)
    assert not {s["chunk_id"] for s in external}.intersection(hit.chunk_id for hit in hits)
    reopened = client.get(f"/api/ask/{result['id']}", headers={"X-User-Id": "employee"}).json()
    assert reopened["sources"] == result["sources"]
    assert reopened["web_search"] == result["web_search"]
    assert (
        client.get(
            f"/api/ask/{result['id']}/web-search", headers={"X-User-Id": "employee"}
        ).status_code
        == 200
    )
    assert (
        client.get(
            f"/api/ask/{result['id']}/web-search", headers={"X-User-Id": "finance"}
        ).status_code
        == 404
    )


def test_google_429_is_visible_and_never_fabricates_web_context(client, monkeypatch):
    def blocked(*args, **kwargs):
        raise HTTPException(503, "Google blocked this local browser search (HTTP 429).")

    monkeypatch.setattr(web_search, "scan_website", blocked)
    response = client.post(
        "/api/ask",
        headers={"X-User-Id": "employee"},
        json={"question": "annual leave days", "web_search": True},
    )
    result = response.json()
    assert response.status_code == 201
    assert result["web_search"]["status"] == "blocked"
    assert "429" in result["web_search"]["message"]
    assert all(s["source_origin"] == "knowledge_base" for s in result["sources"])


def test_blocked_google_page_is_visually_inspectable_but_not_answer_evidence(client, monkeypatch):
    blocked = {**capture(), "blocked": True, "http_status": 429, "results": []}
    monkeypatch.setattr(web_search, "scan_website", lambda *args, **kwargs: blocked)
    response = client.post(
        "/api/ask",
        headers={"X-User-Id": "employee"},
        json={"question": "annual leave days", "web_search": True},
    )
    result = response.json()
    assert result["web_search"]["status"] == "blocked"
    assert result["web_search"]["google_vision_observations"] == blocked["observations"]
    assert all(s["source_origin"] == "knowledge_base" for s in result["sources"])
    evidence = client.get(f"/api/ask/{result['id']}/web-search", headers={"X-User-Id": "employee"})
    assert evidence.status_code == 200
    assert evidence.json()["screenshots"] == blocked["screenshots"]


def test_websearch_requires_opt_in_and_authentication(client, monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("No browser without authenticated opt-in")

    monkeypatch.setattr(web_search, "scan_website", forbidden)
    assert (
        client.post("/api/ask", json={"question": "annual leave", "web_search": True}).status_code
        == 401
    )
    result = client.post(
        "/api/ask", headers={"X-User-Id": "employee"}, json={"question": "annual leave"}
    ).json()
    assert result["web_search"] is None


def test_failed_pages_leave_no_partial_context(client, db, monkeypatch):
    def unavailable(*args, **kwargs):
        raise HTTPException(503, "Vision unavailable")

    monkeypatch.setattr(web_search, "scan_website", unavailable)
    result = client.post(
        "/api/ask",
        headers={"X-User-Id": "employee"},
        json={
            "question": "annual leave days",
            "web_search": True,
            "web_urls": ["https://public.example/reference"],
        },
    ).json()
    assert result["web_search"]["status"] == "unavailable"
    assert result["web_search"]["discovery"] == "user-selected-urls"
    assert (
        db.scalar(
            select(func.count()).select_from(Document).where(Document.context_run_id.is_not(None))
        )
        == 0
    )


def test_discovered_pdf_has_pdf_ocr_and_vision_citations(client, monkeypatch):
    from test_ojk import pdf

    monkeypatch.setattr(
        web_search,
        "download_pdf",
        lambda url: (url, pdf("Bank wajib menerapkan dua faktor autentikasi.")),
    )
    monkeypatch.setattr(web_search, "scan_pdf", lambda *args: deepcopy(capture()))
    response = client.post(
        "/api/ask",
        headers={"X-User-Id": "employee"},
        json={
            "question": "dua faktor autentikasi",
            "web_search": True,
            "web_urls": ["https://public.example/regulation.pdf"],
        },
    )
    assert response.status_code == 201, response.text
    sources = response.json()["sources"]
    assert any(
        s["media_type"] == "application/pdf"
        and s["extraction_method"] == "pdf_text"
        and s["source_origin"] == "internet"
        for s in sources
    )
    assert any(s["extraction_method"] == "vision" for s in sources)


def test_background_job_is_fast_private_and_excludes_pending_history(client, db, monkeypatch):
    queued = []
    monkeypatch.setattr(main.web_search_pool, "submit", lambda fn, run_id: queued.append(run_id))
    response = client.post(
        "/api/web-search/asks",
        headers={"X-User-Id": "employee"},
        json={"question": "annual leave days"},
    )
    assert response.status_code == 202
    run_id = response.json()["id"]
    assert queued == [run_id]
    run = db.get(QuestionRun, run_id)
    assert run.filters["web_search"] is True
    assert (
        client.get(f"/api/web-search/asks/{run_id}", headers={"X-User-Id": "employee"}).json()[
            "status"
        ]
        == "running"
    )
    assert (
        client.get(f"/api/web-search/asks/{run_id}", headers={"X-User-Id": "finance"}).status_code
        == 404
    )
    assert client.get(f"/api/ask/{run_id}", headers={"X-User-Id": "employee"}).status_code == 409
    assert run_id not in {
        r["id"] for r in client.get("/api/ask", headers={"X-User-Id": "employee"}).json()
    }
    assert (
        client.post(
            "/api/web-search/asks",
            headers={"X-User-Id": "employee"},
            json={"question": "another question"},
        ).status_code
        == 409
    )
    monkeypatch.setattr(
        web_search,
        "scan_website",
        lambda *args, **kwargs: (_ for _ in ()).throw(HTTPException(503, "Google HTTP 429")),
    )
    main.execute_question(
        AskInput(question=run.question, **run.filters), db, db.get(User, "employee"), run
    )
    complete = client.get(
        f"/api/web-search/asks/{run_id}", headers={"X-User-Id": "employee"}
    ).json()
    assert complete["status"] == "complete"
    assert complete["answer"]["web_search"]["status"] == "blocked"


def test_worker_completes_and_recovers_persisted_jobs(client, db, monkeypatch):
    queued = []
    monkeypatch.setattr(main.web_search_pool, "submit", lambda fn, run_id: queued.append(run_id))

    @contextmanager
    def session():
        yield db

    monkeypatch.setattr(main, "SessionLocal", session)

    def blocked(*args, **kwargs):
        raise HTTPException(503, "Google HTTP 429")

    monkeypatch.setattr(web_search, "scan_website", blocked)
    response = client.post(
        "/api/web-search/asks",
        headers={"X-User-Id": "employee"},
        json={"question": "annual leave days"},
    )
    run_id = response.json()["id"]
    main.recover_web_searches()
    assert queued == [run_id, run_id]
    main.process_web_search(run_id)
    result = client.get(f"/api/web-search/asks/{run_id}", headers={"X-User-Id": "employee"}).json()
    assert result["status"] == "complete"
    assert result["answer"]["sources"]
    assert result["answer"]["web_search"]["status"] == "blocked"
