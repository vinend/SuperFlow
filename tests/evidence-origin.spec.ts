import { expect, test } from "@playwright/test";

test("saved answers label knowledge evidence and respect reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/copilotkit/**", (route) => route.abort());
  await page.goto("/ask");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many annual leave days do I get?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const card = page.getByRole("region", { name: "Answer Card" });
  await expect(card.locator(".source-reference").first()).toContainText(
    "From Knowledge Base",
  );
  await expect(card.locator(".origin-badge.internet")).toHaveCount(0);
  expect(
    await page
      .locator("#workspace-main")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page
    .getByRole("button", { name: "Open citation 1", exact: true })
    .first()
    .click();
  const panel = page.getByRole("dialog", { name: "Source Panel" });
  await expect(panel.getByLabel("Evidence origin")).toContainText(
    "From Knowledge Base",
  );
  expect(
    await panel.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
});

test("website preview separates Internet/Puppeteer capture from vision observations", async ({
  page,
}) => {
  // UI fixture only. Real OJK browser + vision verification is recorded separately.
  await page.route("**/api/web-sources/preview", (route) =>
    route.fulfill({
      json: {
        id: "preview-fixture",
        url: "https://example.org/",
        title: "Public reference",
        captured_at: "2026-10-17T00:00:00Z",
        text: "Visible webpage text",
        text_truncated: false,
        coverage: "First viewport only",
        vision_model: "vision-fixture",
        screenshots: [],
        observations: [
          {
            screenshot: 1,
            visible_text: "Image text",
            visual_description: "A chart",
            limitations: "Chart labels need review",
          },
        ],
      },
    }),
  );
  await page.goto("/knowledge");
  await page.evaluate(() => localStorage.setItem("superflow.demo-user", "sme"));
  await page.reload();
  await page
    .getByRole("button", { name: "Import website", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Import website" });
  await dialog.getByLabel("Website URL").fill("https://example.org/");
  await dialog
    .getByRole("button", { name: "Scan website", exact: true })
    .click();
  await expect(dialog.getByLabel("Evidence origin")).toContainText("Internet");
  await expect(dialog.getByLabel("Evidence origin")).toContainText("Puppeteer");
  await expect(dialog.getByLabel("Evidence origin")).toContainText(
    "Vision scan",
  );
  await expect(dialog).toContainText("Vision observation · not a cited fact");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
