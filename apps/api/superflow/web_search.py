"""Local Google/Puppeteer + vision evidence, isolated to one authorized Ask run."""

import base64
import hashlib
import io
import json
import subprocess
import uuid
from datetime import date, datetime, timezone
from urllib.parse import quote, urlsplit

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .audit import record
from .config import ROOT, settings
from .knowledge import citation_payload
from .models import Document, DocumentChunk, DocumentVersion, QuestionRun, User, WebsiteCapture
from .parsing import ParsedChunk, ParseError, parse_file
from .retrieval import tokens
from .schemas import AskInput
from .website_capture import WebsiteInput, capture_markdown, observe_screenshots, scan_website


def scan_pdf(data: bytes, url: str, title: str, page_number: int, text: str) -> dict:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(data)
    try:
        page = pdf[page_number - 1]
        try:
            bitmap = page.render(scale=min(1280 / page.get_width(), 900 / page.get_height()))
            try:
                image = bitmap.to_pil()
                try:
                    output = io.BytesIO()
                    image.save(output, format="PNG")
                finally:
                    image.close()
            finally:
                bitmap.close()
        finally:
            page.close()
    finally:
        pdf.close()
    png = output.getvalue()
    screenshots = [
        {"y": 0, "image": base64.b64encode(png).decode(), "sha256": hashlib.sha256(png).hexdigest()}
    ]
    return {
        "engine": "pdfium",
        "url": url,
        "requested_url": url,
        "title": title,
        "text": text,
        "text_truncated": True,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "coverage": f"PDF page {page_number} only; native/OCR excerpts are separate evidence.",
        "vision_model": settings.vision_model,
        "screenshots": screenshots,
        "observations": observe_screenshots(screenshots),
    }


def download_pdf(url: str) -> tuple[str, bytes]:
    """Node downloader validates/pins public DNS, redirects, PDF magic and size."""
    result = subprocess.run(
        [settings.web_node_executable, str(ROOT / "scripts/capture-website.mjs")],
        input=json.dumps({"url": url, "downloadPdf": True}),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=55,
        cwd=ROOT,
    )
    if result.returncode:
        raise HTTPException(422, "This public PDF could not be downloaded.")
    payload = json.loads(result.stdout)
    data = base64.b64decode(payload["content"], validate=True)
    if len(data) > 10 * 1024 * 1024 or not data.startswith(b"%PDF-"):
        raise HTTPException(422, "The result is not a supported PDF.")
    return payload["url"], data


def persist_source(
    db: Session, user: User, run: QuestionRun, query: AskInput, result: dict
) -> list[str]:
    url = WebsiteInput(url=result["url"]).url
    pdf = urlsplit(url).path.lower().endswith(".pdf")
    capture = None
    if pdf:
        final_url, data = download_pdf(url)
        media_type, chunks = parse_file("google-result.pdf", data, chunker="llamaindex")
        filename = "google-result.pdf"
        url = final_url
    else:
        capture_payload = scan_website(url, max_screenshots=1)
        url = capture_payload["url"]
        data = capture_markdown(capture_payload)
        media_type, chunks = parse_file("website-capture.md", capture_payload["text"].encode())
        chunks = [
            ParsedChunk("Captured webpage text", chunk.text, "web_capture") for chunk in chunks
        ]
        filename = "website-capture.md"
        capture = WebsiteCapture(actor_id=user.id, payload=capture_payload)
    # Rank within the downloaded document, without adding it to the shared index.
    query_terms = tokens(query.question)
    selected = sorted(
        chunks, key=lambda item: sum((query_terms & tokens(item.text)).values()), reverse=True
    )[: 2 if pdf else 1]
    if pdf:
        capture = WebsiteCapture(
            actor_id=user.id,
            payload=scan_pdf(
                data,
                url,
                result.get("title") or "PDF search result",
                selected[0].page_number or 1,
                "\n\n".join(chunk.text for chunk in selected),
            ),
        )
    if capture:
        for observation in capture.payload["observations"][:1]:
            text = (
                "Unverified visual observation; compare with the original screenshot.\n"
                + observation["visual_description"]
                + "\nText read by vision: "
                + observation["visible_text"]
                + "\nLimitations: "
                + observation["limitations"]
            )[:2200]
            selected.append(ParsedChunk("Vision observation / screenshot 1", text, "vision"))
    document = Document(
        id=str(uuid.uuid4()),
        title=(result.get("title") or urlsplit(url).hostname or "Web result")[:200],
        domain=query.domain or "Compliance",
        owner_id=user.id,
        context_run_id=run.id,
        authority_level=1,
        access_roles=[user.role_id],
        related_document_ids=[],
    )
    version = DocumentVersion(
        id=str(uuid.uuid4()),
        version="capture-1",
        effective_date=date.today(),
        status="active",
        filename=filename,
        media_type=media_type,
        checksum=hashlib.sha256(data).hexdigest(),
        file_content=data,
        source_provenance={
            "source_url": url,
            "publisher": urlsplit(url).hostname,
            "kind": "question-web-context",
            "legal_status": "unverified-web-reference",
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "capture_engine": "puppeteer" if not pdf else None,
            "discovery_method": "google-local-puppeteer"
            if not query.web_urls
            else "user-selected-result-url",
            "vision_model": capture.payload["vision_model"] if capture else None,
        },
    )
    document.versions.append(version)
    version.chunks = [
        DocumentChunk(
            id=str(uuid.uuid4()),
            ordinal=index,
            section_path=chunk.section,
            text=chunk.text,
            extraction_method=chunk.extraction_method,
            page_number=chunk.page_number,
            ocr_confidence=chunk.ocr_confidence,
        )
        for index, chunk in enumerate(selected)
    ]
    db.add(document)
    db.flush()
    if capture:
        capture.version_id = version.id
        db.add(capture)
        db.flush()
    return [chunk.id for chunk in version.chunks]


def collect(db: Session, user: User, run: QuestionRun, query: AskInput, start: int) -> list[dict]:
    public_query = (query.web_query or query.question)[:200]
    report = {
        "status": "blocked",
        "query": public_query,
        "search_url": "https://www.google.com/search?q=" + quote(public_query),
        "engine": "google-puppeteer-local",
        "vision_model": settings.vision_model,
        "sources_read": 0,
        "failures": [],
        "message": "",
        "search_capture_id": None,
    }
    if not settings.web_capture_enabled:
        report["message"] = (
            "WebSearch is disabled by the operator. This answer uses local knowledge only."
        )
        run.web_search_result = dict(report)
        return []
    try:
        if query.web_urls:
            results = [{"url": WebsiteInput(url=url).url} for url in query.web_urls]
            report["discovery"] = "user-selected-urls"
        else:
            search = scan_website(
                "https://www.google.com/search", search_query=public_query, max_screenshots=1
            )
            search_capture = WebsiteCapture(actor_id=user.id, payload=search)
            db.add(search_capture)
            db.flush()
            report["search_capture_id"] = search_capture.id
            report["google_vision_observations"] = search["observations"]
            if search.get("blocked"):
                report["http_status"] = search.get("http_status")
                report["message"] = (
                    "Google blocked this local browser search (HTTP 429). "
                    if search.get("http_status") == 429
                    else "Google returned no accessible result links. "
                ) + "Vision inspected the returned page; no web results entered AI context."
                run.web_search_result = dict(report)
                record(
                    db,
                    user,
                    run.id,
                    "web_search_blocked",
                    engine=report["engine"],
                    reason=report["message"],
                )
                return []
            results = search["results"]
            report["discovery"] = "google-results"
    except (HTTPException, ValueError, OSError, subprocess.TimeoutExpired) as error:
        report["message"] = (
            str(error.detail)
            if isinstance(error, HTTPException)
            else "Local Google browser search failed."
        )
        run.web_search_result = dict(report)
        record(
            db,
            user,
            run.id,
            "web_search_blocked",
            engine=report["engine"],
            reason=report["message"],
        )
        return []
    chunk_ids = []
    for result in results[: settings.web_search_max_results]:
        try:
            # A failed page leaves no half-created source or citation behind.
            with db.begin_nested():
                chunk_ids.extend(persist_source(db, user, run, query, result))
            report["sources_read"] += 1
        except (
            HTTPException,
            ParseError,
            ValueError,
            OSError,
            subprocess.TimeoutExpired,
            KeyError,
        ):
            report["failures"].append(
                {
                    "url": result.get("url"),
                    "message": "Page/PDF or vision unavailable; excluded from AI context.",
                }
            )
    report["status"] = (
        "complete"
        if chunk_ids and not report["failures"]
        else "partial"
        if chunk_ids
        else "unavailable"
    )
    report["message"] = (
        f"Read {report['sources_read']} public source(s) on this device. "
        + ("Using your selected URLs; Google discovery was skipped. " if query.web_urls else "")
        + "Web/vision observations require review."
        if chunk_ids
        else "No accessible result documents could be read. This answer uses local knowledge only."
    )
    run.web_search_result = dict(report)
    record(
        db,
        user,
        run.id,
        "web_context_collected",
        engine=report["engine"],
        sources_read=report["sources_read"],
        failed=len(report["failures"]),
    )
    return [
        citation_payload(db, user, chunk_id, start + index)
        for index, chunk_id in enumerate(chunk_ids)
    ]
