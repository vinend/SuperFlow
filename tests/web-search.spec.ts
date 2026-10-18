import { expect, test } from "@playwright/test";

test("Enable WebSearch sends explicit opt-in and shows blocked Google without claiming web evidence", async ({
  page,
}) => {
  let requested: Record<string, unknown> | null = null;
  let completedAnswer: Record<string, unknown> | null = null;
  let polls = 0;
  await page.route("**/api/web-search/asks", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requested = route.request().postDataJSON();
    // UI-only failure fixture. Backend + real local scans are verified separately.
    const response = await route.fetch({
      url: "http://127.0.0.1:8001/api/ask",
      postData: JSON.stringify({ ...requested, web_search: false }),
    });
    const answer = await response.json();
    completedAnswer = {
      ...answer,
      web_search: {
        status: "blocked",
        query: "public leave guidance",
        search_url: "https://www.google.com/search?q=public+leave+guidance",
        sources_read: 0,
        failures: [],
        message:
          "Google blocked this local browser search (HTTP 429). No web results entered AI context.",
      },
    };
    await route.fulfill({
      status: 202,
      json: { id: "ui-fixture-job", status: "queued" },
    });
  });
  await page.route("**/api/web-search/asks/ui-fixture-job", (route) => {
    if (++polls === 1) return route.abort();
    return route.fulfill({
      json: { status: "complete", answer: completedAnswer },
    });
  });
  await page.goto("/ask");
  await page.locator("details.search-options > summary").click();
  const toggle = page.getByRole("button", {
    name: "Enable WebSearch",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.getByText("WebSearch options", { exact: true }).click();
  await page
    .getByLabel("Public Google query (optional)")
    .fill("public leave guidance");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many annual leave days do I get?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const card = page.getByRole("region", { name: "Answer Card" });
  await expect(card).toContainText("HTTP 429");
  await expect(card).toContainText("WebSearch · Unavailable");
  expect(polls).toBeGreaterThan(1);
  expect(requested).toMatchObject({
    web_search: true,
    web_query: "public leave guidance",
  });
  await expect(card.locator(".origin-badge.internet")).toHaveCount(0);
  await expect(
    card.getByRole("link", { name: "Open Google search" }),
  ).toHaveAttribute("href", /google\.com\/search/);
});
