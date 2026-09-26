import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import can_read
from .models import Document, DocumentChunk, DocumentVersion, User
from .schemas import AskInput

STOP_WORDS = set(
    (
        "a an the is are was were be to of for from and or with on in i my me we our "
        "do does how what which can should must get many about tell please have it "
        "this that as at by"
    ).split()
)
CONCEPTS = {
    "vacation": "leave",
    "holiday": "leave",
    "holidays": "leave",
    "pto": "leave",
    "days": "day",
    "policies": "policy",
    "regulations": "regulation",
    "regulatory": "regulation",
    "permissions": "access",
    "permission": "access",
    "expenses": "expense",
    "claims": "claim",
    "approvals": "approval",
    "vendors": "vendor",
    "quotations": "quotation",
    "proposals": "proposal",
}


def tokens(value: str) -> Counter:
    return Counter(
        CONCEPTS.get(word, word)
        for word in re.findall(r"[a-z0-9]+", value.lower())
        if word not in STOP_WORDS and len(word) > 1
    )


@dataclass(frozen=True)
class Hit:
    chunk_id: str
    score: float


class Retriever(Protocol):
    def retrieve(self, db: Session, user: User, query: AskInput) -> list[Hit]: ...


class KeywordConceptRetriever:
    """Local deterministic ranking adapter, not a semantic embedding model."""

    def retrieve(self, db: Session, user: User, query: AskInput) -> list[Hit]:
        documents = db.scalars(select(Document)).all()
        # Access is resolved BEFORE reading chunk content or ranking candidates.
        allowed = [
            document
            for document in documents
            if can_read(user, document)
            and (not query.domain or document.domain == query.domain)
            and (not query.document_ids or document.id in query.document_ids)
        ]
        if not allowed:
            return []
        versions = db.scalars(
            select(DocumentVersion).where(
                DocumentVersion.document_id.in_([document.id for document in allowed]),
                DocumentVersion.status.in_(
                    ["active", "outdated"] if query.include_outdated else ["active"]
                ),
                DocumentVersion.effective_date <= date.today(),
            )
        ).all()
        if not versions:
            return []
        docs = {document.id: document for document in allowed}
        version_map = {version.id: version for version in versions}
        chunks = db.scalars(
            select(DocumentChunk).where(DocumentChunk.version_id.in_(version_map))
        ).all()
        query_terms = tokens(query.question)
        if not query_terms:
            return []
        ranked: list[Hit] = []
        for chunk in chunks:
            version = version_map[chunk.version_id]
            document = docs[version.document_id]
            body = tokens(chunk.section_path + " " + chunk.text)
            title = tokens(document.title)
            overlap = set(query_terms) & set(body)
            if not overlap:
                continue
            body_score = sum(min(body[word], 3) for word in overlap) / math.sqrt(
                sum(body.values()) + 1
            )
            coverage = len(overlap) / len(query_terms)
            title_score = len(set(query_terms) & set(title)) / len(query_terms)
            score = body_score + coverage + title_score * 0.35
            score += document.authority_level * 0.015
            if version.status == "active":
                score += 0.05
            if coverage >= 0.20:
                ranked.append(Hit(chunk.id, score))
        return sorted(ranked, key=lambda hit: (-hit.score, hit.chunk_id))[:4]
