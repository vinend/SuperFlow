import { resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".runtime/playwright");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto("http://127.0.0.1:3000/knowledge");
  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("sme");
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page
    .getByLabel("Document title", { exact: true })
    .fill("Scanned travel reimbursement policy");
  await page
    .locator('input[name="file"]')
    .setInputFiles(".runtime/demo-scanned-travel.png");
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/documents") &&
      response.request().method() === "POST",
    { timeout: 300_000 },
  );
  await page.getByRole("button", { name: "Upload document" }).click();
  const response = await uploaded;
  if (response.status() !== 201) {
    throw new Error("OCR upload failed: " + response.status() + " " + (await response.text()));
  }
  const document = await response.json();
  const method = document.versions[0].chunks[0].extraction_method;
  if (method !== "ocr") throw new Error("Expected OCR extraction, got " + method);
  await page.goto("http://127.0.0.1:3000/ask");
  await page.getByRole("combobox", { name: "Question source" }).selectOption(document.id);
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Within how many days must the receipt be submitted under the scanned travel policy?");
  const answered = page.waitForResponse(
    (value) =>
      value.url().endsWith("/api/ask") && value.request().method() === "POST",
    { timeout: 360_000 },
  );
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const answer = await (await answered).json();
  if (
    answer.provider !== "ollama-grounded-v1" ||
    !answer.sources.some((source) => source.extraction_method === "ocr") ||
    !/30 days/i.test(answer.answer)
  ) {
    throw new Error("OCR Ask did not produce grounded Qwen output");
  }
  await page.getByRole("button", { name: "Open citation 1" }).click();
  await page.getByRole("dialog", { name: "Source Panel" }).waitFor();
  await page.screenshot({ path: "artifacts/verification/ocr-preflight.png" });
  console.log(
    JSON.stringify({
      document_id: document.id,
      extraction_method: method,
      provider: answer.provider,
      reliability: answer.reliability.status,
      source_count: answer.sources.length,
    }),
  );
} finally {
  await browser.close();
}
