import { expect, test, type Page } from "@playwright/test";

async function analyst(page: Page, alert = "AML-2026-001") {
  await page.goto("/investigations");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("compliance");
  await page
    .getByRole("navigation", { name: "Synthetic investigations" })
    .getByRole("link", { name: alert })
    .click();
  await expect(
    page.getByRole("heading", {
      name: `Investigation Review — Alert ${alert}`,
    }),
  ).toBeVisible();
}

test("complete synthetic investigation persists through independent checker", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await analyst(page);
  await expect(
    page.getByText("3 of 5 configured checks completed."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit to independent checker" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Collect permitted evidence" })
    .click();
  await expect(
    page.getByText("5 of 5 configured checks completed."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Analyst notes" })
    .fill("Synthetic records and screening results inspected.");
  await page
    .getByRole("textbox", { name: "Recommendation for checker" })
    .fill(
      "Please review the recorded indicators and supporting synthetic evidence.",
    );
  await page.getByRole("button", { name: "Save recommendation" }).click();
  await expect(
    page.getByRole("button", { name: "Submit to independent checker" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Submit to independent checker" })
    .click();
  await expect(
    page.getByText("Waiting for checker", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Waiting for checker", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("compliance_checker");
  await page.getByRole("link", { name: "Open checker review" }).click();
  await expect(
    page.getByText("Please review the recorded indicators"),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill("Synthetic evidence and analyst recommendation reviewed.");
  await page.getByRole("button", { name: "Approve recommendation" }).click();
  await expect(
    page.getByText("Completed", { exact: true }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/investigations");
  await expect(
    page.getByRole("heading", { name: /Investigation Review — Alert/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("failed synthetic tool remains blocked with retry history", async ({
  page,
}) => {
  await analyst(page, "AML-2026-002");
  await page
    .getByRole("button", { name: "Collect permitted evidence" })
    .click();
  await expect(
    page.getByText("More information required").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic watchlist adapter is unavailable").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit to independent checker" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByText("Synthetic watchlist adapter is unavailable").first(),
  ).toBeVisible();
});

test("conflicting synthetic evidence requires human judgment", async ({
  page,
}) => {
  await analyst(page, "AML-2026-003");
  await page
    .getByRole("button", { name: "Collect permitted evidence" })
    .click();
  await expect(page.getByText("Needs review").first()).toBeVisible();
  await expect(page.getByText("salary-only funds").first()).toBeVisible();
});

test("unrelated roles cannot inspect investigation evidence", async ({
  page,
}) => {
  await page.goto("/investigations");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  await expect(
    page.getByText("Investigation Review is available to Compliance."),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Rizky Pratama");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("finance");
  await expect(page.locator("body")).not.toContainText("Rizky Pratama");
});
