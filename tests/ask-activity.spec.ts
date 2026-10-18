import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Conversation activity reports actual stages with motion ${reducedMotion}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    let finish = false;
    await page.route("**/api/chats/*", async (route) => {
      const response = await route.fetch();
      const chat = await response.json();
      if (!finish && route.request().method() === "GET" && chat.turns?.length) {
        chat.turns = chat.turns.map((turn: Record<string, unknown>) => ({
          ...turn,
          status: "running",
          answer: null,
          events: [
            {
              stage: "generating",
              message:
                "Composing an answer from 2 authorized evidence excerpts.",
              at: new Date().toISOString(),
            },
          ],
        }));
      }
      await route.fulfill({ json: chat });
    });
    await page.route("**/api/chats/*/turns/*", async (route) => {
      const response = await route.fetch();
      if (finish) return route.fulfill({ response });
      const turn = await response.json();
      await route.fulfill({
        json: {
          ...turn,
          status: "running",
          answer: null,
          events: [
            {
              stage: "generating",
              message:
                "Composing an answer from 2 authorized evidence excerpts.",
              at: new Date().toISOString(),
            },
          ],
        },
      });
    });
    await page.goto("/ask#role=employee");
    await page.locator(".chat-scope > summary").click();
    await page.getByLabel("Question domain").selectOption("People");
    await page
      .getByRole("textbox", { name: "Your question" })
      .fill("How many annual leave days do I get?");
    await page
      .getByRole("button", { name: "Ask question", exact: true })
      .click();
    const activity = page.getByRole("region", { name: "Answer activity" });
    try {
      await expect(activity).toContainText("2 authorized evidence excerpts");
      await expect(activity).toContainText("Search scopePeople");
      await expect(activity.locator('li[aria-current="step"]')).toContainText(
        "Compose your answer",
      );
      await expect(activity).not.toContainText("100%");
      if (reducedMotion === "reduce") {
        expect(
          await activity
            .locator(".activity-spark")
            .evaluate((el) => getComputedStyle(el).animationName),
        ).toBe("none");
      }
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      finish = true;
    }
    await expect(
      page.getByRole("region", { name: "Answer Card" }),
    ).toBeVisible();
    await expect(activity).toHaveCount(0);
    await page.locator(".chat-process > summary").click();
    await expect(
      page.getByRole("list", { name: "Process history" }),
    ).toContainText("verifying");
  });
}
