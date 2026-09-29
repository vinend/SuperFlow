import json

import httpx
import pytest

from superflow.providers import OllamaAnswerProvider, ProviderUnavailable


def source(citation_id=1):
    return {
        "citation_id": citation_id,
        "title": "Annual Leave Policy",
        "version": "2.0",
        "status": "active",
        "section_path": "Entitlement",
        "excerpt": "Employees receive 15 days of annual leave.",
    }


def provider(handler):
    return OllamaAnswerProvider(
        base_url="http://ollama.test:11434",
        model="qwen3.5:9b",
        num_ctx=8192,
        num_predict=512,
        temperature=0.1,
        timeout_seconds=10,
        transport=httpx.MockTransport(handler),
    )


def test_ollama_provider_returns_validated_cited_paragraphs():
    def handler(request):
        payload = json.loads(request.content)
        assert request.url == "http://ollama.test:11434/api/chat"
        assert payload["model"] == "qwen3.5:9b"
        assert payload["format"]["additionalProperties"] is False
        assert payload["think"] is False
        assert payload["options"]["num_predict"] == 512
        assert "authorized_sources" in payload["messages"][1]["content"]
        return httpx.Response(
            200,
            json={
                "message": {
                    "content": json.dumps(
                        {
                            "paragraphs": [
                                {
                                    "text": "Employees receive 15 days of annual leave.",
                                    "citation_id": 1,
                                }
                            ]
                        }
                    )
                }
            },
        )

    result = provider(handler).answer("How many leave days do I get?", [source()])
    assert result == "Employees receive 15 days of annual leave. [1]"


def test_ollama_provider_rejects_citations_outside_authorized_context():
    def handler(_):
        return httpx.Response(
            200,
            json={
                "message": {
                    "content": json.dumps(
                        {"paragraphs": [{"text": "Unsupported claim.", "citation_id": 99}]}
                    )
                }
            },
        )

    with pytest.raises(ProviderUnavailable, match="outside the authorized context"):
        provider(handler).answer("Question", [source()])


def test_ollama_provider_fails_safely_on_unavailable_or_malformed_runtime():
    def handler(_):
        return httpx.Response(503, json={"error": "model unavailable"})

    with pytest.raises(ProviderUnavailable, match="unavailable"):
        provider(handler).answer("Question", [source()])


def test_ollama_provider_does_not_call_runtime_without_evidence():
    def handler(_):
        raise AssertionError("runtime must not be called")

    result = provider(handler).answer("Question", [])
    assert "could not find supporting evidence" in result
