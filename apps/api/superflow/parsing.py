import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 2_000_000
MEDIA_TYPES = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class ParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedChunk:
    section: str
    text: str


def parse_file(filename: str, data: bytes) -> tuple[str, list[ParsedChunk]]:
    suffix = Path(filename).suffix.lower()
    if suffix not in MEDIA_TYPES:
        raise ParseError("Supported formats are TXT, Markdown, PDF, and DOCX.")
    if not data:
        raise ParseError("The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise ParseError("The file exceeds the 10 MB upload limit.")
    sections: list[tuple[str, str]] = []
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
            for number, page in enumerate(reader.pages, start=1):
                sections.append((f"Page {number}", page.extract_text() or ""))
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
    except Exception as error:
        raise ParseError("Cannot parse this file. Check the format and file integrity.") from error
    if sum(len(body) for _, body in sections) > MAX_TEXT:
        raise ParseError("Extracted text exceeds the supported size.")
    chunks: list[ParsedChunk] = []
    for heading, body in sections:
        body = body.replace("\x00", "").strip()
        for paragraph in re.split(r"\n\s*\n", body):
            block: list[str] = []
            length = 0
            for word in paragraph.split():
                for offset in range(0, len(word), 1100):
                    piece = word[offset : offset + 1100]
                    if length + len(piece) + 1 > 1200 and block:
                        chunks.append(ParsedChunk(heading, " ".join(block)))
                        block, length = [], 0
                    block.append(piece)
                    length += len(piece) + 1
            if block:
                chunks.append(ParsedChunk(heading, " ".join(block)))
    if not chunks:
        message = (
            "No extractable text. Scanned PDFs require OCR before upload."
            if suffix == ".pdf"
            else "No readable text found in this file."
        )
        raise ParseError(message)
    return MEDIA_TYPES[suffix], chunks
