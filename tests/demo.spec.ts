import { expect, test } from "@playwright/test";

test("Home is a short launchpad and the presenter page is absent", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Needs your attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Ask SuperFlow/ }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recently updated" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "My Work" })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).not.toContainText(/Impact|Demo walkthrough|Reviews \/ Approvals|My Work/);
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Demo walkthrough" }),
  ).toHaveCount(0);
});

test("launchpad navigation is keyboard and mobile accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
