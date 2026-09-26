import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  citedParagraphs,
  displayVersion,
  fileType,
} from "../../apps/web/lib/knowledge-view.ts";
import type {
  KnowledgeDocument,
  Source,
  Version,
} from "../../apps/web/lib/api.ts";

test("only actual backend sources become clickable citation references", () => {
  const sources = [{ citation_id: 2, chunk_id: "stored-chunk" }] as Source[];
  const paragraphs = citedParagraphs(
    "Unmatched marker [99]\n\nStored excerpt [2]\n\nUntrusted <script> text",
    sources,
  );
  assert.equal(paragraphs[0].text, "Unmatched marker [99]");
  assert.equal(paragraphs[0].source, undefined);
  assert.equal(paragraphs[1].source?.chunk_id, "stored-chunk");
  assert.equal(paragraphs[1].text, "Stored excerpt");
  assert.equal(paragraphs[2].text, "Untrusted <script> text");
});

test("repository presentation respects persisted active status rather than version label order", () => {
  const draft = { id: "draft", version: "9.0", status: "draft" } as Version;
  const active = { id: "active", version: "2.0", status: "active" } as Version;
  const document = { versions: [draft, active] } as KnowledgeDocument;
  assert.equal(displayVersion(document)?.id, "active");
  assert.equal(
    displayVersion({ versions: [draft] } as KnowledgeDocument)?.status,
    "draft",
  );
  assert.equal(
    displayVersion({ versions: [] } as unknown as KnowledgeDocument),
    undefined,
  );
});

test("document format comes from the actual stored file identity", () => {
  assert.equal(fileType("POLICY.PDF"), "PDF");
  assert.equal(fileType("proposal.docx"), "DOCX");
  assert.equal(fileType("policy.md"), "Markdown");
  assert.equal(fileType(undefined), "Source");
});
