import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureWebsite } from "../../scripts/capture-website.mjs";

const query = "site:ojk.go.id POJK 21 2023";
try {
  const result = await captureWebsite(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    resolve(".runtime/playwright/chromium-1243/chrome-win64/chrome.exe"),
    { search: query, scanSearch: true, maxScreenshots: 1 },
  );
  if (result.screenshots?.length) {
    await mkdir("artifacts/demo/screenshots", { recursive: true });
    await writeFile(
      "artifacts/demo/screenshots/google-scan.png",
      Buffer.from(result.screenshots[0].image, "base64"),
    );
  }
  console.log(
    JSON.stringify({
      blocked: result.blocked,
      http_status: result.http_status,
      result_count: result.results.length,
      screenshot_sha256: result.screenshots?.[0]?.sha256,
      screenshot_path: result.screenshots?.length
        ? "artifacts/demo/screenshots/google-scan.png"
        : null,
    }),
  );
} catch (error) {
  console.log(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
