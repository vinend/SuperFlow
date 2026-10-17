"""Reproducible, curated cross-division PDF references from official publishers."""

import argparse
import hashlib
import io
import json
from datetime import date, datetime, timezone
from pathlib import PurePosixPath
from urllib.parse import unquote

import httpx
from fastapi import HTTPException
from pypdf import PdfReader
from sqlalchemy import select

from .audit import record
from .auth import require_manage
from .config import ROOT
from .db import SessionLocal
from .knowledge import add_version
from .models import Document, User
from .parsing import MAX_BYTES
from .schemas import ROLE_IDS, Metadata, VersionInput

HOSTS = {
    "www.fdic.gov",
    "www.consumerfinance.gov",
    "files.consumerfinance.gov",
    "nvlpubs.nist.gov",
    "www.ilo.org",
}


def public_url(value: str) -> str:
    url = httpx.URL(value)
    if (
        url.scheme != "https"
        or url.host not in HOSTS
        or url.userinfo
        or url.port not in {None, 443}
    ):
        raise ValueError("Use an allowlisted official publisher's HTTPS URL.")
    return str(url.copy_with(fragment=None))


def download(url: str) -> tuple[str, bytes]:
    url = public_url(url)
    with httpx.Client(timeout=60, trust_env=False) as client:
        for _ in range(4):
            with client.stream("GET", url) as response:
                if response.is_redirect:
                    url = public_url(str(response.url.join(response.headers["location"])))
                    continue
                response.raise_for_status()
                data = bytearray()
                for part in response.iter_bytes():
                    data.extend(part)
                    if len(data) > MAX_BYTES:
                        raise ValueError("Reference PDF exceeds the 10 MB limit.")
                if not data.startswith(b"%PDF-"):
                    raise ValueError("Publisher did not return a PDF.")
                return url, bytes(data)
    raise ValueError("Too many publisher redirects.")


def ingest(db, user, source, data, url):
    require_manage(user)
    url = public_url(url)
    # Stable across a fresh redirect-following download and a cached rerun.
    requested_url = public_url(source.get("source_url", url))
    doc_id = "public-" + hashlib.sha256(requested_url.encode()).hexdigest()[:24]
    document = db.scalar(select(Document).where(Document.id == doc_id).with_for_update())
    checksum = hashlib.sha256(data).hexdigest()
    if document:
        # The curated importer must not silently rewrite an existing restricted library.
        if user.role_id != "governance" and user.role_id not in document.access_roles:
            raise HTTPException(404, "Document unavailable.")
        if any(v.checksum == checksum for v in document.versions):
            return document
    else:
        metadata = Metadata(
            title=source["title"],
            domain=source["domain"],
            owner_id=user.id,
            authority_level=2,
            access_roles=sorted(ROLE_IDS),
        )
        document = Document(id=doc_id, **metadata.model_dump())
        db.add(document)
        db.flush()
    filename = unquote(PurePosixPath(httpx.URL(url).path).name)[:195]
    version = add_version(
        db,
        document,
        VersionInput(version="sha-" + checksum[:16], effective_date=date.today(), status="active"),
        filename if filename.lower().endswith(".pdf") else "public-reference.pdf",
        data,
        chunker="llamaindex",
    )
    version.source_provenance = {
        "source_url": url,
        "requested_url": requested_url,
        "landing_url": source.get("landing_url"),
        "publisher": source["publisher"],
        "retrieved_at": source["retrieved_at"],
        "published_on": source.get("published_on"),
        "jurisdiction": source["jurisdiction"],
        "kind": source["kind"],
        "legal_status": "unverified-reference",
        "usage_scope": (
            "Public learning/reference only; not internal policy or Indonesian legal advice."
        ),
        "sha256": checksum,
        "chunker": "llamaindex",
        "chunk_size_tokens": 512,
        "chunk_overlap_tokens": 128,
        "discovery_method": "curated-official-links",
    }
    record(
        db,
        user,
        document.id,
        "public_source_imported",
        entity_type="document",
        version_id=version.id,
        checksum=checksum,
        publisher=source["publisher"],
    )
    db.flush()
    return document


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--user", default="governance")
    args = parser.parse_args()
    sources = json.loads((ROOT / "data/public/manifest.json").read_text(encoding="utf-8"))[
        "sources"
    ]
    cache = ROOT / ".runtime/public"
    cache.mkdir(parents=True, exist_ok=True)
    report = []
    for source in sources:
        path = cache / (source["id"] + ".pdf")
        resolved_path = path.with_suffix(".url")
        url = public_url(source["source_url"])
        if path.exists():
            data = path.read_bytes()
            if resolved_path.exists():
                url = public_url(resolved_path.read_text(encoding="utf-8"))
        else:
            url, data = download(url)
            path.write_bytes(data)
            resolved_path.write_text(url, encoding="utf-8")
        row = {
            "id": source["id"],
            "domain": source["domain"],
            "source_url": url,
            "bytes": len(data),
            "pages": len(PdfReader(io.BytesIO(data)).pages),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        print(json.dumps(row), flush=True)
        if not args.download_only:
            with SessionLocal() as db:
                user = db.get(User, args.user)
                if user is None or not user.active:
                    parser.error("Select an active knowledge maintainer.")
                source["retrieved_at"] = datetime.fromtimestamp(
                    path.stat().st_mtime, timezone.utc
                ).isoformat()
                document = ingest(db, user, source, data, url)
                db.commit()
                row.update(
                    document_id=document.id, chunks=sum(len(v.chunks) for v in document.versions)
                )
                print(
                    f"Source ready: {document.title}: {row['chunks']} chunks.",
                    flush=True,
                )
        report.append(row)
        (cache / "import-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
