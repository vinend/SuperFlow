import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureWebsite } from "../../scripts/capture-website.mjs";

const output = "artifacts/demo/screenshots";
const result = await captureWebsite(
  "https://example.com/",
  resolve(".runtime/playwright/chromium-1243/chrome-win64/chrome.exe"),
  { maxScreenshots: 1 },
);
await mkdir(output, { recursive: true });
await writeFile(
  `${output}/puppeteer-example.png`,
  Buffer.from(result.screenshots[0].image, "base64"),
);
console.log(
  JSON.stringify({
    requested_url: result.requested_url,
    final_url: result.url,
    title: result.title,
    text_length: result.text.length,
    screenshot_sha256: result.screenshots[0].sha256,
    screenshot_path: `${output}/puppeteer-example.png`,
  }),
);
