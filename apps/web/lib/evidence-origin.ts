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
    source.extraction_method === "web_capture" ||
    source.extraction_method === "vision";
  const methods: string[] = [];
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
  if (internet) {
    if (
      source.capture_engine === "puppeteer" ||
      source.extraction_method === "web_capture"
    )
      methods.push("Puppeteer");
    if (source.extraction_method === "vision")
      methods.push("Vision observation");
    else if (source.vision_model) methods.push("Vision scan");
  }
  return {
    internet,
    label: internet ? "Internet" : "From Knowledge Base",
    methods,
  };
}
