import { expect, test } from "@playwright/test";

test("conversation follow-ups, process history, rename and separate sessions survive reload", async ({
  page,
}) => {
  await page.goto("/ask#role=employee");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many annual leave days do I get?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const first = page.getByRole("article", { name: "Message 1", exact: true });
  await expect(
    first.getByRole("region", { name: "Answer Card" }),
  ).toContainText("15 days");
  await first.locator(".chat-process summary").click();
  await expect(
    first.getByRole("list", { name: "Process history" }),
  ).toContainText("verifying");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Summarize that in three points.");
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  const second = page.getByRole("article", { name: "Message 2", exact: true });
  await expect(
    second.getByRole("region", { name: "Answer Card" }),
  ).toContainText("15 days");
  await second.locator(".chat-process summary").click();
  await expect(
    second.getByRole("list", { name: "Process history" }),
  ).toContainText("earlier replies");
  const savedUrl = page.url();
  await page.getByRole("button", { name: "Rename chat" }).click();
  await page
    .getByLabel("Chat title", { exact: true })
    .fill("Leave planning conversation");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Leave planning conversation",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    second.getByRole("region", { name: "Answer Card" }),
  ).toContainText("15 days");
  await second.locator(".chat-process summary").click();
  await expect(
    second.getByRole("list", { name: "Process history" }),
  ).toContainText("earlier replies");
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How do I request system access?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.getByRole("region", { name: "Answer Card" })).toBeVisible();
  expect(page.url()).not.toBe(savedUrl);
  await page
    .getByRole("navigation", { name: "Saved chats" })
    .getByRole("button", { name: "Leave planning conversation" })
    .click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page
    .getByRole("article", { name: "Message 1", exact: true })
    .getByRole("button", { name: "Open citation 1", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Source Panel" }),
  ).toContainText("15 days");
  await page.screenshot({
    path: "artifacts/screenshots/superbank-chat-history.png",
    fullPage: true,
  });
});

test("Superbank brand, tab icon and roomy composer fit mobile and keep chats private", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ask");
  await expect(page.locator(".superbank-wordmark img").first()).toHaveAttribute(
    "alt",
    "Superbank",
  );
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute(
    "href",
    /icon\.png/,
  );
  const input = page.getByRole("textbox", { name: "Your question" });
  await expect(input).toBeEnabled();
  const bounds = await input.boundingBox();
  expect(bounds!.width).toBeGreaterThan(400);
  expect(bounds!.height).toBeGreaterThanOrEqual(96);
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("finance");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many annual leave days do I get?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.getByRole("region", { name: "Answer Card" })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "What can we work through?" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "artifacts/screenshots/superbank-chat-mobile.png",
    fullPage: true,
  });
});
