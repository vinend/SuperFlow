"""Read-only public-web screening research. Never claims a confirmed or clear identity."""

import hashlib
from urllib.parse import urlsplit

from .config import settings
from .investigation_contracts import BrowserScreeningResult, ToolName
from .models import WebsiteCapture
from .website_capture import WebsiteInput, scan_website

OFFICIAL_HOSTS = (
    "ofac.treas.gov",
    "main.un.org",
    "scsanctions.un.org",
    "sanctionssearch.ofac.treas.gov",
    "sanctionslist.ofac.treas.gov",
    "ojk.go.id",
    "ppatk.go.id",
)


class ScreeningUnavailable(RuntimeError):
    pass


def official_url(url):
    host = (urlsplit(url).hostname or "").lower()
    return any(host == allowed or host.endswith("." + allowed) for allowed in OFFICIAL_HOSTS)


def collect_screening(db, user, investigation, tool):
    if not settings.web_capture_enabled:
        raise ScreeningUnavailable("Browser screening is disabled; evidence remains missing.")
    name = investigation.context_data.get("intake", {}).get("profile", {}).get("customer_name")
    if not name:
        raise ScreeningUnavailable("Submitted customer identity is required for browser research.")
    clean_name = " ".join(name.replace('"', " ").split())[:90]
    watchlist = tool == ToolName.WATCHLIST
    query = (
        f'"{clean_name}" (site:main.un.org OR site:ofac.treas.gov OR site:ppatk.go.id)'
        if watchlist
        else f'"{clean_name}" (fraud OR corruption OR "money laundering" OR penipuan)'
    )[:200]
    urls = investigation.context_data["intake"].get(
        "screening_urls" if watchlist else "news_urls", []
    )
    search_id = None
    if urls:
        candidates = [{"url": WebsiteInput(url=url).url} for url in urls]
    else:
        search = scan_website(
            "https://www.google.com/search", search_query=query, max_screenshots=1
        )
        capture = WebsiteCapture(actor_id=user.id, payload=search)
        db.add(capture)
        db.flush()
        search_id = capture.id
        if search.get("blocked"):
            raise ScreeningUnavailable(
                "Google blocked browser screening (HTTP 429/CAPTCHA or inaccessible results). "
                "No clear result was produced; collect an authorized public source explicitly."
            )
        candidates = search.get("results", [])
    sources = []
    for candidate in candidates[:2]:
        url = WebsiteInput(url=candidate["url"]).url
        if watchlist and not official_url(url):
            continue
        payload = scan_website(url, max_screenshots=1)
        if (
            payload.get("blocked")
            or len(payload.get("text", "").strip()) < 20
            or (watchlist and not official_url(payload["url"]))
        ):
            continue
        capture = WebsiteCapture(actor_id=user.id, payload=payload)
        db.add(capture)
        db.flush()
        sources.append(
            {
                "url": payload["url"],
                "title": str(payload.get("title") or url)[:300],
                "excerpt": payload["text"][:6000],
                "capture_id": capture.id,
                "checksum": hashlib.sha256(payload["text"].encode()).hexdigest(),
            }
        )
    if not sources:
        raise ScreeningUnavailable(
            "No accessible supporting source was collected. This is incomplete research, "
            "not a negative screening result."
        )
    return BrowserScreeningResult(
        query=query,
        search_capture_id=search_id,
        discovery="analyst-selected-urls" if urls else "google",
        candidate_count=len(sources),
        sources=sources,
    ).model_dump(mode="json")
