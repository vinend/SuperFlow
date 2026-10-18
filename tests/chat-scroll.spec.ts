import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import type { Chat, ChatTurn } from "../apps/web/lib/chat";
import type { Answer } from "../apps/web/lib/api";

// UI-only timing/long-answer fixture. Real-model evidence is verified separately.
async function conversationFixture(page: Page, request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:8001/api/ask", {
    headers: { "X-User-Id": "employee" },
    data: { question: "How many annual leave days do I get?" },
  });
  expect(response.ok()).toBe(true);
  const base = (await response.json()) as Answer;
  const chat: Chat = {
    id: crypto.randomUUID(),
    title: "Scroll regression",
    turns: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  let complete = false;
  function currentTurn() {
    const turn = chat.turns.at(-1)!;
    if (complete) {
      turn.status = "complete";
      turn.answer = {
        ...base,
        id: turn.id,
        question: turn.question,
        answer: Array.from(
          { length: 12 },
          () =>
            `${"Employees receive 15 days of annual leave. ".repeat(4)} [1]`,
        ).join("\n\n"),
      };
    }
    return turn;
  }
  await page.route("**/api/chats", (route) =>
    route.fulfill({
      status: route.request().method() === "POST" ? 201 : 200,
      json: route.request().method() === "POST" ? chat : [],
    }),
  );
  await page.route("**/api/chats/*", (route) => route.fulfill({ json: chat }));
  await page.route("**/api/chats/*/turns", (route) => {
    complete = false;
    const turn: ChatTurn = {
      id: crypto.randomUUID(),
      question: route.request().postDataJSON().question,
      status: "running",
      answer: null,
      error: null,
      created_at: new Date().toISOString(),
      scope: {
        domain: null,
        document_ids: [],
        include_outdated: false,
        web_search: false,
      },
      resolution: {
        status: "ready",
        intent: "knowledge_answer",
        view: null,
        investigation_id: null,
        alert_reference: null,
        message: "Searching accessible sources.",
      },
      events: [
        {
          stage: "generating",
          message: "Composing the reply.",
          at: new Date().toISOString(),
        },
      ],
    };
    chat.turns.push(turn);
    return route.fulfill({
      status: 202,
      json: { id: turn.id, status: "queued" },
    });
  });
  await page.route("**/api/chats/*/turns/*", (route) =>
    route.fulfill({ json: currentTurn() }),
  );
  return {
    finish: () => {
      complete = true;
    },
  };
}

for (const mobile of [false, true]) {
  test(`long replies open at their beginning on ${mobile ? "mobile with reduced motion" : "desktop"}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
    }
    const fixture = await conversationFixture(page, request);
    await page.goto("/ask");
    await page
      .getByRole("textbox", { name: "Your question" })
      .fill("How many annual leave days?");
    await page
      .getByRole("button", { name: "Ask question", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Answer activity" }),
    ).toBeVisible();
    const outerScroll = await page.evaluate(() => scrollY);
    fixture.finish();
    const card = page.getByRole("region", { name: "Answer Card" });
    await expect(card).toContainText("15 days");
    await expect
      .poll(() =>
        page.locator(".chat-messages").evaluate((el) => {
          const header = el.querySelector(".chat-assistant-label")!;
          return Math.abs(
            header.getBoundingClientRect().top -
              el.getBoundingClientRect().top -
              24,
          );
        }),
      )
      .toBeLessThan(3);
    expect(
      await card.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThan(
      await page.locator(".chat-messages").evaluate((el) => el.clientHeight),
    );
    expect(await page.evaluate(() => scrollY)).toBe(outerScroll);
    await page.screenshot({
      path: `artifacts/screenshots/chat-reply-top-${mobile ? "mobile" : "desktop"}.png`,
    });
  });
}

test("a reply finishing does not move someone reading an earlier message", async ({
  page,
  request,
}) => {
  const fixture = await conversationFixture(page, request);
  await page.goto("/ask");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many annual leave days?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Answer activity" }),
  ).toBeVisible();
  fixture.finish();
  await expect(page.getByRole("region", { name: "Answer Card" })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Explain that further.");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Answer activity" }),
  ).toBeVisible();
  const messages = page.locator(".chat-messages");
  await messages.hover();
  await page.mouse.wheel(0, -10000);
  await expect.poll(() => messages.evaluate((el) => el.scrollTop)).toBe(0);
  fixture.finish();
  await expect(page.getByRole("region", { name: "Answer Card" })).toHaveCount(
    2,
  );
  await expect.poll(() => messages.evaluate((el) => el.scrollTop)).toBe(0);
});
