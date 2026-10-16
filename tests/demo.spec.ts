import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["scripts/prepare-e2e.mjs", "--presentation"],
    {
      stdio: "pipe",
    },
  );
});
test.afterAll(() => {
  execFileSync(process.execPath, ["scripts/prepare-e2e.mjs"], {
    stdio: "pipe",
  });
});

test("walkthrough switches identity, opens prepared work and survives refresh", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Demo walkthrough", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Platform walkthrough" })
      .getByRole("listitem"),
  ).toHaveCount(6);
  await page
    .getByRole("link", {
      name: "Open Continue into controlled work as Employee",
    })
    .click();
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
    "employee",
  );
  await expect(page.getByRole("main")).toContainText("Annual Leave Review");
  await page.goto("/demo");
  await page
    .getByRole("link", {
      name: "Open Turn regulation into remediation as Compliance",
    })
    .click();
  await expect(page).toHaveURL(/\/regulatory/);
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
    "compliance",
  );
  await expect(page.getByRole("main")).toContainText(
    "Synthetic Digital Operations Regulation",
  );
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
    "compliance",
  );
  await page.goto("/demo");
  await page
    .getByRole("link", {
      name: "Open Resolve an investment assumption as Finance",
    })
    .click();
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
    "finance",
  );
  await expect(page.getByRole("main")).toContainText("Proposal A");
});

test("walkthrough has keyboard access, mobile navigation and no horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Demo walkthrough", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await mkdir("artifacts/screenshots/demo", { recursive: true });
  await page.screenshot({
    path: "artifacts/screenshots/demo/desktop.png",
    fullPage: true,
  });
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
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/screenshots/demo/mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", {
      name: "Open Measure the shared platform as Governance Admin",
    })
    .click();
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
    "governance",
  );
  await expect(page.getByRole("main")).toContainText("Illustrative simulation");
  expect(errors).toEqual([]);
});
