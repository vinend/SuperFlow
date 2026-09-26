import type { KnowledgeDocument, Source } from "./api.ts";

export function displayVersion(document: KnowledgeDocument) {
  return (
    document.versions.find((item) => item.status === "active") ||
    document.versions[0]
  );
}

export function citedParagraphs(answer: string, sources: Source[]) {
  return answer.split("\n\n").map((paragraph) => {
    const marker = paragraph.match(/\[(\d+)\]$/);
    const source = marker
      ? sources.find((item) => item.citation_id === Number(marker[1]))
      : undefined;
    return {
      text: source ? paragraph.slice(0, marker!.index).trim() : paragraph,
      source,
    };
  });
}

export function fileType(filename?: string) {
  const extension = filename?.split(".").pop()?.toLowerCase();
  return (
    (
      { md: "Markdown", txt: "Text", pdf: "PDF", docx: "DOCX" } as Record<
        string,
        string
      >
    )[extension || ""] || "Source"
  );
}
