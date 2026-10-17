"""RPL's LlamaIndex retrieval updated for persisted, permission-filtered vectors."""

from .embeddings import EmbeddingUnavailable


def retrieve_nodes(candidates, rows, provider, query_vector, question, top_k):
    try:
        from llama_index.core import VectorStoreIndex
        from llama_index.core.embeddings import BaseEmbedding
        from llama_index.core.schema import QueryBundle, TextNode
        from pydantic import PrivateAttr

        class LocalEmbedding(BaseEmbedding):
            _backend = PrivateAttr()

            def __init__(self, backend):
                super().__init__(model_name=backend.model)
                self._backend = backend

            def _get_query_embedding(self, query):
                return self._backend.query(query)

            async def _aget_query_embedding(self, query):
                return self._get_query_embedding(query)

            def _get_text_embedding(self, text):
                return self._backend.documents([text])[0]

        # Only already-authorized source records enter LlamaIndex. Embeddings are
        # persisted in PostgreSQL; no global disk index or cloud default is used.
        nodes = [
            TextNode(
                id_=chunk.id,
                text=chunk.text,
                embedding=rows[chunk.id].vector,
                metadata={"section": chunk.section_path},
            )
            for _, _, chunk in candidates
        ]
        index = VectorStoreIndex(
            nodes=nodes,
            embed_model=LocalEmbedding(provider),
            transformations=[],
            show_progress=False,
        )
        result = index.as_retriever(similarity_top_k=min(top_k, len(nodes))).retrieve(
            QueryBundle(query_str=question, embedding=query_vector)
        )
        return [(item.node.node_id, float(item.score or 0)) for item in result]
    except Exception as error:
        raise EmbeddingUnavailable(
            "LlamaIndex retrieval unavailable. Install the pinned RAG dependencies "
            "and rebuild the index."
        ) from error
