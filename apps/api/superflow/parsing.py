import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader

from .config import settings
from .ocr import OcrUnavailable, recognize, recognize_pdf_page

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 2_000_000
MEDIA_TYPES = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


class ParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedChunk:
    section: str
    text: str
    extraction_method: str = "native"
    page_number: int | None = None
    ocr_confidence: float | None = None


def parse_file(filename: str, data: bytes, *, chunker="legacy") -> tuple[str, list[ParsedChunk]]:
    suffix = Path(filename).suffix.lower()
    if suffix not in MEDIA_TYPES:
        raise ParseError("Supported formats are TXT, Markdown, PDF, DOCX, PNG, and JPEG.")
    if not data:
        raise ParseError("The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise ParseError("The file exceeds the 10 MB upload limit.")
    sections: list[tuple[str, str]] = []
    provenance: dict[str, tuple[str, int | None, float | None]] = {}
    try:
        if suffix in {".txt", ".md"}:
            value = data.decode("utf-8-sig")
            heading = "Document"
            body: list[str] = []
            for line in value.splitlines():
                if re.match(r"^#{1,6}\s", line):
                    if body:
                        sections.append((heading, "\n".join(body)))
                    heading, body = line.lstrip("# ").strip()[:300] or "Section", []
                else:
                    body.append(line)
            if body:
                sections.append((heading, "\n".join(body)))
        elif suffix == ".pdf":
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise ParseError("Encrypted PDFs are not supported. Upload an unencrypted copy.")
            if len(reader.pages) > settings.pdf_max_pages:
                raise ParseError(f"PDF exceeds the {settings.pdf_max_pages}-page parsing limit.")
            ocr_pages = 0
            for number, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                method, confidence = "pdf_text", None
                if page.images:
                    ocr_pages += 1
                    if ocr_pages > settings.ocr_max_pages:
                        raise ParseError(
                            f"PDF exceeds the {settings.ocr_max_pages}-page OCR limit."
                        )
                    result = recognize_pdf_page(data, number - 1)
                    if text.strip():
                        known = {
                            re.sub(r"\s+", " ", line).strip().lower() for line in text.splitlines()
                        }
                        extra = [
                            line
                            for line in result.text.splitlines()
                            if line.strip().lower() not in known
                        ]
                        text = text + "\n" + "\n".join(extra)
                        method = "mixed"
                    else:
                        text, method = result.text, "ocr"
                    confidence = result.confidence
                sections.append((f"Page {number}", text))
                provenance[f"Page {number}"] = (method, number, confidence)
                if sum(len(body) for _, body in sections) > MAX_TEXT:
                    raise ParseError("Extracted text exceeds the supported size.")
        elif suffix in {".png", ".jpg", ".jpeg"}:
            from PIL import Image

            with Image.open(io.BytesIO(data)) as image:
                result = recognize(image)
            sections.append(("Image 1", result.text))
            provenance["Image 1"] = ("ocr", 1, result.confidence)
        else:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if sum(item.file_size for item in archive.infolist()) > 30 * 1024 * 1024:
                    raise ParseError("Expanded DOCX exceeds the 30 MB parsing limit.")
            document = DocxDocument(io.BytesIO(data))
            heading, body = "Document", []
            for paragraph in document.paragraphs:
                if paragraph.style.name.startswith("Heading"):
                    if body:
                        sections.append((heading, "\n\n".join(body)))
                    heading, body = paragraph.text[:300] or "Section", []
                elif paragraph.text.strip():
                    body.append(paragraph.text)
            if body:
                sections.append((heading, "\n\n".join(body)))
            for number, table in enumerate(document.tables, start=1):
                rows = [" | ".join(cell.text for cell in row.cells) for row in table.rows]
                sections.append((f"Table {number}", "\n".join(rows)))
    except ParseError:
        raise
    except OcrUnavailable as error:
        raise ParseError(str(error)) from error
    except Exception as error:
        raise ParseError("Cannot parse this file. Check the format and file integrity.") from error
    if sum(len(body) for _, body in sections) > MAX_TEXT:
        raise ParseError("Extracted text exceeds the supported size.")
    chunks: list[ParsedChunk] = []
    for heading, body in sections:
        method, page_number, confidence = provenance.get(heading, ("native", None, None))

        def append(text):
            chunks.append(ParsedChunk(heading, text, method, page_number, confidence))

        body = body.replace("\x00", "").strip()
        if chunker == "llamaindex":
            from llama_index.core.node_parser import SentenceSplitter

            splitter = SentenceSplitter(chunk_size=512, chunk_overlap=128)
            parts = re.split(r"(?m)(?=^\s*Pasal\s+\d+\s*$)", body)
            for part in parts:
                articles = re.findall(r"(?m)^\s*Pasal\s+(\d+)\s*$", part)
                section = heading + (f" / Pasal {articles[0]}" if articles else "")
                for piece in splitter.split_text(part):
                    if piece.strip():
                        chunks.append(ParsedChunk(section, piece, method, page_number, confidence))
            continue
        for paragraph in re.split(r"\n\s*\n", body):
            block: list[str] = []
            length = 0
            for word in paragraph.split():
                for offset in range(0, len(word), 1100):
                    piece = word[offset : offset + 1100]
                    if length + len(piece) + 1 > 1200 and block:
                        append(" ".join(block))
                        # Preserve context at long-paragraph boundaries without changing
                        # source/page identity or crossing into another section.
                        overlap: list[str] = []
                        for previous in reversed(block):
                            if sum(len(item) + 1 for item in overlap) + len(previous) + 1 > 150:
                                break
                            overlap.insert(0, previous)
                        block = overlap
                        length = sum(len(item) + 1 for item in block)
                        if length + len(piece) + 1 > 1200:
                            block, length = [], 0
                    block.append(piece)
                    length += len(piece) + 1
            if block:
                append(" ".join(block))
    if not chunks:
        message = (
            "No extractable text. Scanned PDFs require OCR before upload."
            if suffix == ".pdf"
            else "No readable text found in this file."
        )
        raise ParseError(message)
    return MEDIA_TYPES[suffix], chunks
