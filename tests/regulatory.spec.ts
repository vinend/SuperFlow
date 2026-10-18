import { expect, test, type Page } from "@playwright/test";

async function role(page: Page, value: string) {
  await page.getByRole("combobox", { name: "Demo role" }).selectOption(value);
}

async function decided(page: Page, title: string, status: string) {
  await expect(
    page.getByRole("article", { name: new RegExp(`^${title}`) }),
  ).toContainText(status);
}

async function reject(page: Page, title: string, reason: string) {
  const form = page.getByRole("form", { name: `Decision for ${title}` });
  await page
    .getByRole("article", { name: new RegExp(`^${title}`) })
    .getByRole("button", { name: "Not a gap" })
    .click();
  await form.getByRole("textbox", { name: "Rejection reason" }).fill(reason);
  await form.getByRole("button", { name: "Record not a gap" }).click();
  await decided(page, title, "Not a gap");
}

test("Compliance turns a regulation change into approved remediation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await role(page, "compliance");
  await expect(
    page.getByRole("region", { name: "Needs your attention" }),
  ).toContainText("Regulatory review");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Regulatory Review" })
    .click();
  await expect(page).toHaveURL(/\/regulatory/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Regulatory Review", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Regulation" }),
  ).toContainText("v1.0 → v2.0");
  await page
    .getByRole("button", { name: "Start Regulatory Review", exact: true })
    .click();
  await expect(page).toHaveURL(/\/regulatory\?review=/);
  const reviewUrl = page.url();

  // Comparison: previous vs current text with the detected requirement changes.
  const comparison = page.getByRole("region", {
    name: "Regulation comparison",
  });
  await expect(comparison).toContainText(
    "Frequency: every 12 months → every 6 months",
  );
  await expect(comparison).toContainText(
    "Deadline: within 72 hours → within 24 hours",
  );
  await expect(comparison).toContainText("Duration: 3 years → 5 years");
  await expect(comparison).toContainText("References this article");
  await comparison
    .getByRole("button", { name: /Inspect \[1\] · v1\.0/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Article 4");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Review gaps" }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.locator("body")).not.toContainText(
    /WorkflowRun|GuardResult|Case ID|Phase 4|definition/,
  );

  // Human decisions: evidence is shown before the controls.
  await reject(
    page,
    "Access Review Control Policy",
    "The procedure carries reviewer and revocation detail.",
  );
  await reject(page, "Incident Reporting SOP", "Handled in a separate change.");
  await reject(page, "Record Retention SOP", "Retention register updated.");
  const access = page.getByRole("form", {
    name: "Decision for Access Review SOP",
  });
  await page
    .getByRole("article", { name: /^Access Review SOP/ })
    .getByText("View sources")
    .click();
  await expect(
    page.getByRole("article", { name: /^Access Review SOP/ }),
  ).toContainText("Synthetic Digital Operations Regulation");
  await page
    .getByRole("article", { name: /^Access Review SOP/ })
    .getByRole("button", { name: "Confirm gap" })
    .click();
  await access
    .getByRole("textbox", { name: "Gap statement" })
    .fill(
      "Access Review SOP must adopt a six-month cycle and record the reviewer and revoked permissions.",
    );
  await access
    .getByRole("combobox", { name: "Remediation owner" })
    .selectOption("employee");
  await access.getByRole("button", { name: "Create remediation" }).click();
  await expect(access.getByRole("alert")).toContainText("cannot access");
  await access
    .getByRole("combobox", { name: "Remediation owner" })
    .selectOption("governance");
  await access.getByRole("button", { name: "Create remediation" }).click();
  await decided(page, "Access Review SOP", "Confirmed gap");
  await expect(page.locator(".case-context-bar")).toContainText(
    "Remediation in progress",
  );
  await page.reload();
  await page.getByRole("button", { name: "2. Gaps" }).click();
  await decided(page, "Access Review SOP", "Alex Pratama");
  await page.getByText("Activity and review outcome").click();
  await expect(page.locator(".case-audit")).toContainText(
    "Gap confirmed and remediation assigned",
  );

  // The remediation owner works from My Work, not from an engine console.
  await role(page, "governance");
  await page.goto("/cases");
  await page
    .getByRole("link", {
      name: "Update Access Review SOP for Article 4 — Access review",
    })
    .click();
  await expect(page.locator(".case-context-bar")).toContainText("Remediation");
  await page
    .getByRole("button", { name: "Remediation completed", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Review request" }),
  ).toContainText("Arif Santoso");

  // Independent approval; conflicting current controls require a reason.
  await role(page, "manager");
  await expect(
    page.getByRole("region", { name: "Review request" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Decision action" })
    .selectOption("approve");
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill("Six-month cycle and evidence fields adopted.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".case-context-bar")).toContainText("Completed");

  await role(page, "compliance");
  await page.goto(reviewUrl);
  await page.getByRole("button", { name: "2. Gaps" }).click();
  await expect(page.locator(".case-context-bar")).toContainText(
    "Ready to close",
  );
  await decided(page, "Access Review SOP", "Remediation approved");
  await page.getByText("Activity and review outcome").click();
  await page
    .getByRole("button", { name: "Close regulatory review", exact: true })
    .click();
  await expect(page.locator(".case-context-bar")).toContainText("Completed");
  await page.reload();
  await page.getByText("Activity and review outcome").click();
  await expect(page.locator(".case-audit")).toContainText(
    "Regulatory review closed",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("other roles cannot start or decide regulatory reviews", async ({
  page,
}) => {
  await page.goto("/");
  for (const value of ["employee", "manager", "finance"]) {
    await role(page, value);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).not.toContainText("Regulatory Review");
    await page.goto("/regulatory");
    await expect(
      page.getByRole("heading", {
        name: "Regulatory Review is run by Compliance.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Regulatory Review" }),
    ).toHaveCount(0);
    await page.goto("/");
  }
});
