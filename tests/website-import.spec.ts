import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("public website is captured by Puppeteer, scanned by local vision, saved and cited", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.SUPERFLOW_TEST_WEB_MODELS !== "1",
    "Requires Chromium, internet and the local Ollama vision model.",
  );
  test.setTimeout(1_320_000);
  await page.goto("/knowledge");
  await page.evaluate(() => localStorage.setItem("superflow.demo-user", "sme"));
  await page.reload();
  await page
    .getByRole("button", { name: "Import website", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Import website" });
  await dialog.getByLabel("Website URL").fill("https://example.com");
  const previewResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/web-sources/preview"),
    { timeout: 1_250_000 },
  );
  await dialog
    .getByRole("button", { name: "Scan website", exact: true })
    .click();
  const response = await previewResponse;
  expect(response.status(), await response.text()).toBe(200);
  const capture = await response.json();
  expect(capture.vision_model).toBeTruthy();
  expect(capture.observations.length).toBe(capture.screenshots.length);
  expect(capture.screenshots[0].image.length).toBeGreaterThan(1000);
  await expect(
    dialog.getByRole("img", { name: "Captured website viewport 1" }),
  ).toBeVisible();
  await expect(dialog).toContainText("Vision scan");
  await mkdir("artifacts/screenshots/website-import", { recursive: true });
  await page.screenshot({
    path: "artifacts/screenshots/website-import/preview-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/screenshots/website-import/preview-mobile.png",
  });
  await dialog
    .getByLabel("Document title")
    .fill("Public website example source");
  await dialog
    .getByLabel(
      "I reviewed the captured text, screenshots, and vision observations.",
    )
    .check();
  const saveResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/web-sources"),
  );
  await dialog.getByRole("button", { name: "Save draft source" }).click();
  const saved = await saveResponse;
  expect(saved.status()).toBe(200);
  const document = await saved.json();
  const version = document.versions[0];
  expect(version.status).toBe("draft");
  const headers = { "X-User-Id": "sme" };
  const evidenceUrl = `http://127.0.0.1:8001/api/documents/${document.id}/versions/${version.id}/web-capture`;
  expect(
    (
      await request.get(evidenceUrl, { headers: { "X-User-Id": "employee" } })
    ).status(),
  ).toBe(404);
  expect((await request.get(evidenceUrl, { headers })).status()).toBe(200);
  expect(
    (
      await request.patch(
        `http://127.0.0.1:8001/api/documents/${document.id}/versions/${version.id}?status=active`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  const answer = await request.post("http://127.0.0.1:8001/api/ask", {
    headers,
    data: {
      question: "domain documentation examples permission",
      document_ids: [document.id],
    },
  });
  expect(answer.status()).toBe(201);
  const result = await answer.json();
  expect(result.sources.length).toBeGreaterThan(0);
  expect(
    result.sources.every(
      (s: { extraction_method: string }) =>
        s.extraction_method === "web_capture",
    ),
  ).toBe(true);
  expect(result.reliability.status).toBe("REVIEW_REQUIRED");
});
