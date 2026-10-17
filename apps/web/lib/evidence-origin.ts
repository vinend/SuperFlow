import type { Source } from "./api.ts";

export type EvidenceIdentity = Pick<
  Partial<Source>,
  | "source_origin"
  | "media_type"
  | "capture_engine"
  | "vision_model"
  | "extraction_method"
> & { filename?: string };

export function evidenceIdentity(source: EvidenceIdentity) {
  const internet =
    source.source_origin === "internet" ||
    source.extraction_method === "web_capture";
  const methods: string[] = [];
  if (internet) {
    methods.push("Puppeteer");
    if (source.vision_model) methods.push("Vision scan");
  } else {
    if (
      source.media_type === "application/pdf" ||
      /\.pdf$/i.test(source.filename || "") ||
      source.extraction_method === "pdf_text" ||
      source.extraction_method === "mixed"
    )
      methods.push("PDF");
    else if (source.media_type?.startsWith("image/")) methods.push("Image");
    else if (/\.docx$/i.test(source.filename || "")) methods.push("DOCX");
    if (
      source.extraction_method === "ocr" ||
      source.extraction_method === "mixed"
    )
      methods.push("OCR");
  }
  return {
    internet,
    label: internet ? "Internet" : "From Knowledge Base",
    methods,
  };
}
