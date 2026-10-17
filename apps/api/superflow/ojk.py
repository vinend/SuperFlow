"""Official PDF ingestion: no search snippets or generated prose become sources."""

import argparse
import hashlib
import io
import json
import subprocess
import uuid
from datetime import date, datetime, timezone
from pathlib import PurePosixPath
from urllib.parse import unquote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import record
from .auth import can_read, current_user, require_manage
from .config import ROOT, settings
from .db import SessionLocal, get_db
from .knowledge import add_version, document_payload
from .models import Document, User
from .parsing import MAX_BYTES
from .schemas import ROLE_IDS, VersionInput

router = APIRouter(prefix="/api/ojk", tags=["OJK sources"])


def official_url(value: str) -> str:
    try:
        url = httpx.URL(value)
        if (
            url.scheme != "https"
            or url.host not in {"ojk.go.id", "www.ojk.go.id"}
            or url.port not in {None, 443}
            or url.userinfo
        ):
            raise ValueError()
        return str(url.copy_with(fragment=None))
    except (ValueError, httpx.InvalidURL) as error:
        raise HTTPException(422, "Use a PDF from the official ojk.go.id HTTPS website.") from error


def download_pdf(url: str) -> tuple[str, bytes]:
    url = official_url(url)
    try:
        with httpx.Client(timeout=60, trust_env=False) as client:
            for _ in range(4):
                with client.stream("GET", url) as response:
                    if response.is_redirect:
                        url = official_url(str(response.url.join(response.headers["location"])))
                        continue
                    response.raise_for_status()
                    data = bytearray()
                    for part in response.iter_bytes():
                        data.extend(part)
                        if len(data) > MAX_BYTES:
                            raise HTTPException(422, "Official PDF exceeds the 10 MB limit.")
                    if not data.startswith(b"%PDF-"):
                        raise HTTPException(422, "The official URL did not return a PDF.")
                    return url, bytes(data)
        raise HTTPException(422, "Too many official-source redirects.")
    except (httpx.HTTPError, KeyError) as error:
        raise HTTPException(
            503, "OJK download unavailable. Retry the official source later."
        ) from error


def ingest(db: Session, user: User, source: dict, data: bytes, final_url: str) -> Document:
    require_manage(user)
    url = official_url(final_url)
    checksum = hashlib.sha256(data).hexdigest()
    doc_id = (
        "ojk-" + hashlib.sha256(url.replace("www.ojk.go.id", "ojk.go.id").encode()).hexdigest()[:24]
    )
    document = db.scalar(select(Document).where(Document.id == doc_id).with_for_update())
    if document:
        if not can_read(user, document):
            raise HTTPException(404, "Document not available to your role.")
        if any(v.checksum == checksum for v in document.versions):
            return document
    else:
        document = Document(
            id=doc_id,
            title=source["title"][:200],
            domain="Compliance",
            owner_id=user.id,
            authority_level=2,
            access_roles=sorted(ROLE_IDS),
            related_document_ids=[],
        )
        db.add(document)
        db.flush()
    label = "sha-" + checksum[:16]
    filename = unquote(PurePosixPath(httpx.URL(url).path).name)[:195]
    if not filename.lower().endswith(".pdf"):
        filename = "ojk-source.pdf"
    version = add_version(
        db,
        document,
        VersionInput(
            version=label,
            effective_date=date.fromisoformat(
                source.get("effective_date") or date.today().isoformat()
            ),
            status="active",
        ),
        filename,
        data,
        chunker="llamaindex",
    )
    version.source_provenance = {
        "source_url": url,
        "requested_url": source["source_url"],
        "landing_url": source.get("landing_url"),
        "publisher": "Otoritas Jasa Keuangan",
        "retrieved_at": source.get("retrieved_at") or datetime.now(timezone.utc).isoformat(),
        "sha256": checksum,
        "kind": source.get("kind", "unclassified-pdf"),
        "legal_status": "unverified-reference",
        "discovery_method": source.get("discovery_method", "curated-official-links"),
        "chunker": "llamaindex",
        "chunk_size_tokens": 512,
        "chunk_overlap_tokens": 128,
    }
    record(
        db,
        user,
        document.id,
        "official_source_imported",
        entity_type="document",
        version_id=version.id,
        checksum=checksum,
        publisher="OJK",
    )
    db.flush()
    return document


class SearchInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    query: str = Field(min_length=3, max_length=200)


@router.post("/search")
def search(value: SearchInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_manage(user)
    if not settings.web_capture_enabled:
        raise HTTPException(503, "Browser search is disabled by the operator.")
    try:
        result = subprocess.run(
            [settings.web_node_executable, str(ROOT / "scripts/capture-website.mjs")],
            input=json.dumps(
                {"search": value.query, "executablePath": settings.web_browser_executable}
            ),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=55,
            cwd=ROOT,
        )
        if result.returncode:
            raise HTTPException(
                503,
                "Google did not return accessible OJK results. Consent, CAPTCHA or rate limits "
                "may block headless search. No bypass or fabricated results are used.",
            )
        payload = json.loads(result.stdout)
        record(
            db,
            user,
            str(uuid.uuid4()),
            "ojk_google_search",
            entity_type="source_discovery",
            result_count=len(payload["results"]),
        )
        db.commit()
        return payload
    except (OSError, subprocess.TimeoutExpired, ValueError, KeyError) as error:
        raise HTTPException(503, "Headless Google search is unavailable.") from error


class PdfInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    url: str = Field(max_length=2048)
    title: str = Field(min_length=3, max_length=200)


@router.post("/import")
def import_pdf(value: PdfInput, db: Session = Depends(get_db), user: User = Depends(current_user)):
    require_manage(user)
    url, data = download_pdf(value.url)
    document = ingest(
        db,
        user,
        {
            "source_url": value.url,
            "title": value.title,
            "discovery_method": "user-selected-official-url",
        },
        data,
        url,
    )
    db.commit()
    return document_payload(db, user, document, detail=True)


def main():
    parser = argparse.ArgumentParser(
        description="Import official OJK PDFs without resetting existing data."
    )
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--user", default="governance")
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Download current bytes again instead of using the local cache.",
    )
    args = parser.parse_args()
    sources = json.loads((ROOT / "data/ojk/manifest.json").read_text(encoding="utf-8"))["sources"]
    cache = ROOT / ".runtime/ojk"
    cache.mkdir(parents=True, exist_ok=True)
    report = []
    for source in sources:
        path = cache / (source["id"] + ".pdf")
        if path.exists() and not args.refresh:
            data, url = path.read_bytes(), source["source_url"]
        else:
            url, data = download_pdf(source["source_url"])
            path.write_bytes(data)
        reader = PdfReader(io.BytesIO(data))
        row = {
            "id": source["id"],
            "source_url": url,
            "bytes": len(data),
            "pages": len(reader.pages),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        print(json.dumps(row), flush=True)
        if not args.download_only:
            with SessionLocal() as db:
                user = db.get(User, args.user)
                if not user or not user.active:
                    parser.error("Select an active knowledge maintainer.")
                source["retrieved_at"] = datetime.fromtimestamp(
                    path.stat().st_mtime, timezone.utc
                ).isoformat()
                document = ingest(db, user, source, data, url)
                db.commit()
                row.update(
                    document_id=document.id, chunks=sum(len(v.chunks) for v in document.versions)
                )
                print(f"Indexed {document.title}: {row['chunks']} chunks", flush=True)
        report.append(row)
    (cache / "import-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
