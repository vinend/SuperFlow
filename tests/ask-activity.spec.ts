import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Ask activity reports live stages and stays usable with motion ${reducedMotion}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    let finish: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route("**/api/ask-progress/*", (route) =>
      route.fulfill({
        json: {
          stage: "generating",
          message: "Composing an answer from 2 authorized evidence excerpts.",
        },
      }),
    );
    await page.route("**/api/ask", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      await gate;
      return route.fulfill({ response });
    });
    await page.goto("/ask#role=employee");
    await page.waitForLoadState("networkidle");
    const domain = page.getByLabel("Question domain");
    await expect(async () => {
      if (!(await domain.isVisible()))
        await page.locator("details.search-options > summary").click();
      await expect(domain).toBeVisible();
    }).toPass({ timeout: 10_000 });
    await domain.selectOption("People");
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
      await expect(activity).toContainText("Check reliability");
      await expect(activity).not.toContainText("100%");
      if (reducedMotion === "reduce") {
        expect(
          await activity
            .locator(".activity-spark")
            .evaluate((el) => getComputedStyle(el).animationName),
        ).toBe("none");
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    } finally {
      finish();
    }
    await expect(
      page.getByRole("region", { name: "Answer Card" }),
    ).toBeVisible();
    await expect(activity).toHaveCount(0);
  });
}
