import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";

test("scanned PDF upload reaches OCR evidence, citation and original download", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.SUPERFLOW_TEST_LOCAL_MODELS !== "1",
    "Requires optional local OCR dependencies.",
  );
  const pdf = execFileSync(process.execPath, [
    "scripts/python.mjs",
    "-c",
    `
import io, sys
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader
image = Image.new("RGB", (1500, 450), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.load_default(size=42)
draw.text((50, 80), "Travel reimbursement requires manager approval.", font=font, fill="black")
draw.text((50, 160), "Submit the receipt within 30 days.", font=font, fill="black")
buffer = io.BytesIO()
canvas = Canvas(buffer, pagesize=(750, 300))
canvas.drawImage(ImageReader(image), 0, 30, width=750, height=225)
canvas.save()
sys.stdout.buffer.write(buffer.getvalue())
`,
  ]);
  const headers = { "X-User-Id": "sme" };
  const response = await request.post("http://127.0.0.1:8001/api/documents", {
    headers,
    multipart: {
      metadata: JSON.stringify({
        title: "Scanned travel reimbursement policy",
        domain: "People",
        owner_id: "sme",
        authority_level: 5,
        access_roles: ["sme", "governance"],
        related_document_ids: [],
      }),
      effective_date: "2026-01-01",
      file: {
        name: "scanned-travel.pdf",
        mimeType: "application/pdf",
        buffer: pdf,
      },
    },
  });
  expect(response.status()).toBe(201);
  const document = await response.json();
  expect(document.versions[0].chunks[0].extraction_method).toBe("ocr");
  const original = await request.get(
    `http://127.0.0.1:8001/api/documents/${document.id}/versions/${document.versions[0].id}/file`,
    { headers },
  );
  expect(await original.body()).toEqual(pdf);
  await page.goto("/ask");
  await page.evaluate(() => localStorage.setItem("superflow.demo-user", "sme"));
  await page.reload();
  if (await page.locator("details.search-options:not([open])").count()) await page.locator("details.search-options > summary").click();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption(document.id);
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Travel reimbursement manager approval");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(
    page.getByText("REVIEW REQUIRED", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open citation 1" }).click();
  const source = page.getByRole("dialog", { name: "Source Panel" });
  await expect(source).toContainText("Page 1");
  await expect(source).toContainText("This source contains OCR text");
  await expect(source).toContainText("30 days");
  await expect(source).toContainText("Lowest OCR recognition score");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await mkdir("artifacts/screenshots/rag-ocr", { recursive: true });
  await page.screenshot({
    path: "artifacts/screenshots/rag-ocr/ocr-source-mobile.png",
  });
  const denied = await request.get(
    `http://127.0.0.1:8001/api/documents/${document.id}`,
    { headers: { "X-User-Id": "employee" } },
  );
  expect(denied.status()).toBe(404);
});
