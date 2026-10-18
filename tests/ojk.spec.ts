import { expect, test } from "@playwright/test";

test("headless Google failure is actionable and does not invent sources", async ({
  page,
}) => {
  await page.goto("/knowledge");
  await page.evaluate(() => localStorage.setItem("superflow.demo-user", "sme"));
  await page.reload();
  await page
    .getByRole("button", { name: "Import website", exact: true })
    .click();
  await page
    .getByText("Find and import official OJK documents", { exact: true })
    .click();
  await page.route("**/api/ojk/search", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail:
          "Google requires consent or CAPTCHA. Paste an official PDF URL instead.",
      }),
    }),
  );
  await page
    .getByRole("textbox", { name: "Search OJK on Google" })
    .fill("OJK digital banking");
  await page
    .getByRole("button", { name: "Search with headless browser" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Import website" }).getByRole("alert"),
  ).toContainText("CAPTCHA");
  await expect(page.getByRole("button", { name: "Use this PDF" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("textbox", { name: "Official OJK PDF URL" }),
  ).toBeVisible();
});

test("real OJK PDF reaches document management and the CopilotKit regulatory card", async ({
  page,
}) => {
  test.skip(
    process.env.SUPERFLOW_TEST_OJK !== "1",
    "Requires official OJK download and optional local OCR/LlamaIndex dependencies.",
  );
  test.setTimeout(360_000);
  await page.goto("/knowledge");
  await page.evaluate(() => localStorage.setItem("superflow.demo-user", "sme"));
  await page.reload();
  await page
    .getByRole("button", { name: "Import website", exact: true })
    .click();
  await page
    .getByText("Find and import official OJK documents", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Official OJK PDF URL" })
    .fill(
      "https://ojk.go.id/id/regulasi/Documents/Pages/Layanan-Digital-oleh-Bank-Umum/FAQ%20POJK%2021%20Tahun%202023.%20Layanan%20Digital%20oleh%20Bank%20Umum.pdf",
    );
  await page
    .getByRole("textbox", { name: "Reference title" })
    .fill("OJK FAQ POJK 21 Tahun 2023 Layanan Digital");
  await page
    .getByRole("checkbox", { name: /Import as a public demo reference/ })
    .check();
  const imported = page.waitForResponse(
    (r) => r.url().endsWith("/api/ojk/import"),
    { timeout: 300000 },
  );
  await page
    .getByRole("button", { name: "Import OJK PDF into Knowledge" })
    .click();
  const response = await imported;
  expect(response.status(), await response.text()).toBe(200);
  const document = await response.json();
  expect(document.versions[0].source_provenance.sha256).toBe(
    "26ce73a6dba3ed2d916fe10f070767a8f7c30d0668f1196ec3f889418893a5c5",
  );
  await expect(
    page.getByRole("link", { name: "Open official PDF" }),
  ).toBeVisible();
  await page.goto("/ask");
  await expect(
    page.locator(".intent-rail[data-agent-ready='true']"),
  ).toBeVisible({ timeout: 20000 });
  const runs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/copilotkit/agent/workspace/run"))
      runs.push(r.url());
  });
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill(
      "Apa saja hal-hal yang diatur dalam POJK 21 Tahun 2023 layanan digital?",
    );
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(
    page.locator('[data-response-view="regulation_brief"]'),
  ).toBeVisible();
  expect(runs.length).toBeGreaterThan(0);
  await expect(page.getByLabel("Official source context")).toContainText(
    "Official OJK evidence",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
