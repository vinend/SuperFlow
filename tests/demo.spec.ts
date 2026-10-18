import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["scripts/prepare-e2e.mjs", "--presentation"],
    { stdio: "pipe" },
  );
});

test.afterAll(() => {
  execFileSync(process.execPath, ["scripts/prepare-e2e.mjs"], {
    stdio: "pipe",
  });
});

test("presentation data opens through user-facing workspaces without a demo page", async ({
  page,
}) => {
  const removedPage = await page.goto("/demo");
  expect(removedPage?.status()).toBe(404);

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Demo walkthrough" }),
  ).toHaveCount(0);
  await page.goto("/cases");
  await expect(page.getByRole("main")).toContainText("Annual Leave Review");
  await page.goto("/workflows");
  await expect(page).toHaveURL(/\/cases$/);

  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("compliance");
  await page.goto("/regulatory");
  await expect(page.getByRole("main")).toContainText(
    "Synthetic Digital Operations Regulation",
  );
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
    "compliance",
  );

  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("finance");
  await page.goto("/investment");
  await expect(page.getByRole("main")).toContainText("Proposal A");
});

test("product entry keeps keyboard, mobile navigation and impact access", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, Maya" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Demo walkthrough" }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);

  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("governance");
  await page.goto("/impact");
  await expect(page.getByRole("main")).toContainText("Illustrative simulation");
  expect(errors).toEqual([]);
});
