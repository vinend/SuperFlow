import { expect, test } from "@playwright/test";

test("Enable WebSearch sends opt-in and shows blocked Google without claiming web evidence", async ({
  page,
}) => {
  let requested: Record<string, unknown> | null = null;
  let polls = 0;
  await page.route("**/api/chats/*/turns", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requested = route.request().postDataJSON();
    const response = await route.fetch({
      postData: JSON.stringify({ ...requested, web_search: false }),
    });
    await route.fulfill({ response });
  });
  await page.route("**/api/chats/*/turns/*", async (route) => {
    if (++polls === 1) return route.abort();
    const response = await route.fetch();
    const turn = await response.json();
    // UI-only blocked search fixture; no live Google request is made by this test.
    if (turn.answer)
      turn.answer.web_search = {
        status: "blocked",
        query: "public leave guidance",
        search_url: "https://www.google.com/search?q=public+leave+guidance",
        sources_read: 0,
        failures: [],
        message:
          "Google blocked this local browser search (HTTP 429). No web results entered AI context.",
      };
    await route.fulfill({ json: turn });
  });
  // Hold the immediate chat read at queued so polling exercises reconnection.
  await page.route("**/api/chats/*", async (route) => {
    const response = await route.fetch();
    const chat = await response.json();
    if (
      route.request().method() === "GET" &&
      chat.turns?.length &&
      polls === 0
    ) {
      chat.turns = chat.turns.map((turn: Record<string, unknown>) => ({
        ...turn,
        status: "queued",
        answer: null,
      }));
    }
    await route.fulfill({ json: chat });
  });
  await page.goto("/ask");
  await page.locator(".chat-scope > summary").click();
  const toggle = page.getByRole("button", { name: /Enable WebSearch/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await page.getByText("WebSearch options", { exact: true }).click();
  await page
    .getByLabel("Public Google query (optional)")
    .fill("public leave guidance");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many annual leave days do I get?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const card = page.getByRole("region", { name: "Answer Card" });
  await expect(card).toContainText("HTTP 429", { timeout: 15000 });
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
