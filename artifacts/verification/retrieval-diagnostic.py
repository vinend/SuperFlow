"""Read-only relevance check against the local authorized PostgreSQL corpus."""

from collections import defaultdict

from sqlalchemy import select

from superflow import embeddings
from superflow.config import settings
from superflow.db import SessionLocal
from superflow.models import ChunkEmbedding, User
from superflow.retrieval import HybridRetriever, authorized_chunks, bm25_rank, tokens
from superflow.schemas import AskInput


QUESTIONS = [
    "How many annual leave days do I get?",
    "What is the annual leave policy for employees?",
    "Apa kewajiban autentikasi dua faktor untuk layanan digital bank menurut POJK 21 Tahun 2023?",
    "What does the uploaded scanned travel policy say about receipts?",
    "What is the purpose of Example Domain?",
    "What is the secret policy for quantum mango banking?",
    "What does NIST Cybersecurity Framework 2.0 say about governance?",
    "What does the FDIC guide say about cash flow?",
    "What does the ILO say about working from home?",
    "Compare OJK digital banking requirements with internal digital operations policy.",
    "How do I take time off?",
]

settings.retrieval_provider = "hybrid"
settings.retrieval_engine = "native"
settings.embedding_model = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
settings.semantic_min_score = 0.3
settings.retrieval_top_k = 6

with SessionLocal() as db:
    user = db.get(User, "employee")
    for question in QUESTIONS:
        query = AskInput(question=question)
        candidates = authorized_chunks(db, user, query)
        by_id = {chunk.id: (doc, chunk) for doc, _, chunk in candidates}
        provider = embeddings.embedding_provider()
        query_vector = embeddings.normalized(provider.query(question))
        rows = {
            row.chunk_id: row
            for row in db.scalars(select(ChunkEmbedding).where(ChunkEmbedding.chunk_id.in_(by_id)))
        }
        cosine = {
            key: sum(a * b for a, b in zip(query_vector, embeddings.normalized(rows[key].vector), strict=True))
            for key in by_id
        }
        lexical = {hit.chunk_id: hit.score for hit in bm25_rank(candidates, question)}
        ranked = HybridRetriever().retrieve(db, user, query)
        print("\nQUERY:", question)
        for hit in ranked:
            doc, chunk = by_id[hit.chunk_id]
            qterms = set(tokens(question))
            cterms = set(tokens(doc.title + " " + chunk.section_path + " " + chunk.text))
            coverage = len(qterms & cterms) / max(len(qterms), 1)
            print(
                f"  {doc.domain:12} {doc.title[:42]:42} "
                f"cos={cosine[hit.chunk_id]:.3f} bm25={lexical.get(hit.chunk_id, 0):.2f} cov={coverage:.2f} "
                f"rank={hit.score:.3f} {chunk.section_path[:50]}"
            )
