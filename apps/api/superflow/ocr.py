"""Local OCR. No document bytes are sent to an external service."""

from dataclasses import dataclass
from functools import lru_cache
from threading import Lock

from .config import settings


class OcrUnavailable(ValueError):
    pass


@dataclass(frozen=True)
class OcrText:
    text: str
    confidence: float


_lock = Lock()


@lru_cache(maxsize=1)
def engine():
    try:
        from rapidocr_onnxruntime import RapidOCR

        return RapidOCR(intra_op_num_threads=2, inter_op_num_threads=1)
    except Exception as error:
        raise OcrUnavailable(
            "OCR is unavailable. Install apps/api/requirements-rag.txt "
            "and verify the local OCR models."
        ) from error


def recognize(image) -> OcrText:
    if not settings.ocr_enabled:
        raise OcrUnavailable("OCR is disabled. Enable OCR_ENABLED to read scanned documents.")
    if image.width * image.height > settings.ocr_max_pixels or max(image.size) > 16000:
        raise OcrUnavailable("OCR page exceeds the supported pixel limit. Reduce its resolution.")
    try:
        import numpy as np

        # The ONNX pipeline is reused but serialized to bound memory and avoid shared engine races.
        with _lock:
            result, _ = engine()(np.asarray(image.convert("RGB")))
        if not result:
            raise OcrUnavailable("OCR found no readable text. Upload a clearer scan.")
        lines = [(str(row[1]).strip(), float(row[2])) for row in result if str(row[1]).strip()]
        if not lines:
            raise OcrUnavailable("OCR found no readable text. Upload a clearer scan.")
        return OcrText("\n".join(text for text, _ in lines), min(score for _, score in lines))
    except OcrUnavailable:
        raise
    except Exception as error:
        raise OcrUnavailable(
            "OCR could not process this page. Check the scan and local OCR runtime."
        ) from error


def recognize_pdf_page(data: bytes, page_index: int) -> OcrText:
    try:
        import pypdfium2 as pdfium

        with pdfium.PdfDocument(data) as document:
            page = document[page_index]
            try:
                width, height = page.get_size()
                scale = min(
                    2.5,
                    16000 / max(width, height, 1),
                    (settings.ocr_max_pixels / max(width * height, 1)) ** 0.5,
                )
                bitmap = page.render(scale=scale)
                try:
                    return recognize(bitmap.to_pil())
                finally:
                    bitmap.close()
            finally:
                page.close()
    except OcrUnavailable:
        raise
    except Exception as error:
        raise OcrUnavailable(
            "OCR cannot render this PDF page. Check the file and PDF runtime."
        ) from error
