import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import embeddings
from .auth import can_read
from .config import settings
from .models import ChunkEmbedding, Document, DocumentChunk, DocumentVersion, User
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
    "reviewed": "review",
    "reviews": "review",
    "receipts": "receipt",
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


def authorized_chunks(db: Session, user: User, query: AskInput):
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
    return [
        (docs[version_map[chunk.version_id].document_id], version_map[chunk.version_id], chunk)
        for chunk in chunks
    ]


class KeywordConceptRetriever:
    """Local deterministic ranking adapter, not a semantic embedding model."""

    def retrieve(self, db: Session, user: User, query: AskInput) -> list[Hit]:
        return self.rank(authorized_chunks(db, user, query), query)

    def rank(self, candidates, query: AskInput) -> list[Hit]:
        query_terms = tokens(query.question)
        if not query_terms:
            return []
        ranked: list[Hit] = []
        for document, version, chunk in candidates:
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


class HybridRetriever:
    """Permission-first cosine retrieval fused with the existing keyword ranker.

    Vectors live with source chunks in PostgreSQL. No global vector search is performed
    before authorization, and no missing/stale index silently drops authorized sources.
    """

    def retrieve(self, db: Session, user: User, query: AskInput) -> list[Hit]:
        candidates = authorized_chunks(db, user, query)
        if not candidates:
            return []  # Do not call the embedding model for an inaccessible source filter.
        provider = embeddings.embedding_provider()
        by_id = {chunk.id: chunk for _, _, chunk in candidates}
        rows = {
            row.chunk_id: row
            for row in db.scalars(
                select(ChunkEmbedding).where(
                    ChunkEmbedding.chunk_id.in_(by_id),
                    ChunkEmbedding.model == provider.model,
                )
            )
        }
        if any(
            chunk_id not in rows or rows[chunk_id].content_hash != embeddings.content_hash(chunk)
            for chunk_id, chunk in by_id.items()
        ):
            raise embeddings.EmbeddingUnavailable(
                "The semantic index is missing or stale for available sources. "
                "Ask a knowledge owner to re-index the documents."
            )
        query_vector = embeddings.normalized(provider.query(query.question))
        semantic = []
        for _, _, chunk in candidates:
            vector = embeddings.normalized(rows[chunk.id].vector)
            if len(vector) != len(query_vector):
                raise embeddings.EmbeddingUnavailable(
                    "Embedding dimensions changed. Re-index the documents."
                )
            score = sum(a * b for a, b in zip(query_vector, vector, strict=True))
            if score >= settings.semantic_min_score:
                semantic.append(Hit(chunk.id, score))
        semantic.sort(key=lambda hit: (-hit.score, hit.chunk_id))
        eligible = {hit.chunk_id for hit in semantic}
        lexical = [
            hit
            for hit in KeywordConceptRetriever().rank(candidates, query)
            if hit.chunk_id in eligible
        ]
        ranks: dict[str, float] = {}
        # The semantic relevance floor also gates incidental keyword overlaps.
        # Reciprocal rank fusion balances exact terms with semantic matches. The score
        # is a retrieval ordering value, never a probability or answer confidence.
        for ranked in (lexical, semantic[:12]):
            for rank, hit in enumerate(ranked, 1):
                ranks[hit.chunk_id] = ranks.get(hit.chunk_id, 0) + 1 / (60 + rank)
        return [
            Hit(key, score)
            for key, score in sorted(ranks.items(), key=lambda item: (-item[1], item[0]))[:4]
        ]


def configured_retriever() -> Retriever:
    return (
        HybridRetriever() if settings.retrieval_provider == "hybrid" else KeywordConceptRetriever()
    )
