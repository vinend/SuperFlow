"""Small local ONNX embedding adapter and persistent chunk-vector indexing."""

import hashlib
import math
from functools import lru_cache
from threading import Lock
from typing import Protocol

from .config import settings
from .models import ChunkEmbedding


class EmbeddingUnavailable(RuntimeError):
    pass


class EmbeddingProvider(Protocol):
    model: str

    def documents(self, texts: list[str]) -> list[list[float]]: ...
    def query(self, text: str) -> list[float]: ...


def normalized(vector) -> list[float]:
    values = [float(item) for item in vector]
    if not values or len(values) > 4096 or not all(math.isfinite(item) for item in values):
        raise EmbeddingUnavailable("Embedding model returned an invalid vector.")
    norm = math.sqrt(sum(item * item for item in values))
    if norm == 0:
        raise EmbeddingUnavailable("Embedding model returned an empty vector.")
    return [item / norm for item in values]


_lock = Lock()


@lru_cache(maxsize=2)
def load_model(model: str, cache: str, threads: int):
    from fastembed import TextEmbedding

    return TextEmbedding(
        model_name=model, cache_dir=cache, threads=threads, providers=["CPUExecutionProvider"]
    )


class FastEmbedProvider:
    def __init__(self):
        self.model = settings.embedding_model

    def embed(self, texts: list[str], *, query=False) -> list[list[float]]:
        if not texts:
            return []
        try:
            with _lock:
                model = load_model(
                    self.model, settings.embedding_cache_dir, settings.embedding_threads
                )
                values = (
                    model.query_embed(texts) if query else model.passage_embed(texts, batch_size=32)
                )
                result = [normalized(vector) for vector in values]
            if len(result) != len(texts) or len({len(vector) for vector in result}) != 1:
                raise EmbeddingUnavailable("Embedding model returned inconsistent results.")
            return result
        except EmbeddingUnavailable:
            raise
        except Exception as error:
            raise EmbeddingUnavailable(
                "Semantic search model is unavailable. Install apps/api/requirements-rag.txt "
                "and prepare the model/index with the rag:reindex command."
            ) from error

    def documents(self, texts):
        return self.embed(texts)

    def query(self, text):
        return self.embed([text], query=True)[0]


def embedding_provider() -> EmbeddingProvider:
    return FastEmbedProvider()


def chunk_content(chunk) -> str:
    return chunk.section_path + "\n" + chunk.text


def content_hash(chunk) -> str:
    return hashlib.sha256(chunk_content(chunk).encode("utf-8")).hexdigest()


def index_embeddings(chunks, *, force=False) -> int:
    """Attach model-specific vectors within the caller's document transaction."""
    provider = embedding_provider()
    missing = [
        chunk
        for chunk in chunks
        if force
        or not any(
            row.model == provider.model and row.content_hash == content_hash(chunk)
            for row in chunk.embeddings
        )
    ]
    vectors = provider.documents([chunk_content(chunk) for chunk in missing])
    if len(vectors) != len(missing):
        raise EmbeddingUnavailable("Embedding model returned an incomplete batch.")
    for chunk, vector in zip(missing, vectors, strict=True):
        row = next((row for row in chunk.embeddings if row.model == provider.model), None)
        if row is None:
            row = ChunkEmbedding(model=provider.model)
            chunk.embeddings.append(row)
        row.content_hash, row.vector = content_hash(chunk), normalized(vector)
    return len(missing)
