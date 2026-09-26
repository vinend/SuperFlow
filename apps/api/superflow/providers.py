from typing import Protocol


class AnswerProvider(Protocol):
    name: str

    def answer(self, question: str, sources: list[dict]) -> str: ...


class ExtractiveDemoProvider:
    name = "deterministic-extractive-v1"

    def answer(self, question: str, sources: list[dict]) -> str:
        if not sources:
            return (
                "I could not find supporting evidence in the sources available to your role "
                "and filters. Try another question or ask a knowledge owner to add a source."
            )
        # Each answer paragraph is a verbatim, source-backed extraction; no invented synthesis.
        return "\n\n".join(f"{source['excerpt']} [{source['citation_id']}]" for source in sources)
