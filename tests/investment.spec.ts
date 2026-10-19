import { expect, test, type Page } from "@playwright/test";

async function role(page: Page, value: string) {
  await page.getByRole("combobox", { name: "Demo role" }).selectOption(value);
}

test("Finance turns a proposal into a source-backed analysis that a manager approves", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await role(page, "finance");
  await expect(
    page.getByRole("region", { name: "Work needing attention" }),
  ).toContainText("Investment Analysis");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Investment Analysis" })
    .click();
  await page
    .getByRole("combobox", { name: "Proposal" })
    .selectOption("proposal-a");
  await expect(
    page.getByRole("checkbox", { name: /Vendor A Quotation/ }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Prepare Analysis", exact: true })
    .click();
  await expect(page).toHaveURL(/\/investment\?analysis=/);
  const analysisUrl = page.url();

  // Conflicting values are surfaced; nothing is calculated until a human selects.
  const assumptions = page.getByRole("region", {
    name: "Assumptions",
    exact: true,
  });
  await page.getByText("View all assumptions").click();
  await expect(assumptions).toContainText("Sources conflict");
  await expect(assumptions).toContainText("Synthetic Cash Flow Projection");
  await expect(
    page.getByRole("heading", { name: "Resolve conflicting values" }),
  ).toBeVisible();
  await expect(page.locator(".case-context-bar")).toContainText(
    "Needs your input",
  );
  const decision = page.getByRole("form", {
    name: "Select value for Initial investment",
  });
  await decision.getByRole("radio", { name: /IDR 195,000,000/ }).check();
  await decision.getByRole("button", { name: "Use selected value" }).click();
  await expect(decision.getByRole("alert")).toContainText(
    "Record why this source value should be used.",
  );
  await decision
    .getByRole("textbox", { name: "Reason for Initial investment" })
    .fill("The vendor quotation is the committed implementation price.");
  await decision.getByRole("button", { name: "Use selected value" }).click();

  // Deterministic results with formula, unit and period.
  await page.getByRole("button", { name: "Review results" }).click();
  await page.getByText("View calculation details").click();
  await expect(page.getByLabel("Deterministic results")).toContainText(
    "IDR 11,041,254",
  );
  await expect(page.getByLabel("Deterministic results")).toContainText(
    "12.59%",
  );
  await expect(page.getByRole("region", { name: "Sensitivity" })).toContainText(
    "−IDR 8,458,746",
  );
  await page
    .getByLabel("Deterministic results")
    .getByText("How it is calculated")
    .first()
    .click();
  await expect(page.getByLabel("Deterministic results")).toContainText(
    "NPV = Σ CFₜ",
  );
  await page.getByRole("button", { name: "Prepare recommendation" }).click();
  await page.getByText("Preview decision memo").click();
  await expect(page.getByLabel("Investment memo")).toContainText(
    "committed implementation price",
  );
  await expect(page.locator(".case-context-bar")).toContainText(
    "Ready to submit",
  );

  // Memo edit, then submit; results and memo freeze for the approver.
  await page.getByRole("button", { name: "Edit memo" }).click();
  const memo = page.getByRole("textbox", { name: "Draft memo" });
  await memo.fill(
    (await memo.inputValue()) + "\nPrepared for the October review.",
  );
  await page.getByRole("button", { name: "Save memo" }).click();
  await expect(page.getByLabel("Investment memo")).toContainText(
    "Prepared for the October review.",
  );
  await expect(page.getByRole("region", { name: "Approval" })).toContainText(
    "Department manager approval",
  );
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.locator(".case-context-bar")).toContainText(
    "Waiting for approval",
  );
  await expect(page.getByRole("region", { name: "Approval" })).toContainText(
    "Waiting for Arif Santoso",
  );
  await expect(page.locator("body")).not.toContainText(
    /WorkflowRun|GuardResult|Case ID|Phase 5|definition/,
  );

  // The approver sees the analysis before the decision controls.
  await role(page, "manager");
  await page.goto("/decisions");
  await page
    .getByRole("link", {
      name: "Workflow Modernization Proposal A — investment analysis",
    })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Investment analysis" }),
  ).toContainText("IDR 11,041,254");
  await page
    .getByRole("combobox", { name: "Decision action" })
    .selectOption("approve");
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill("Quotation price accepted; NPV positive at 10%.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".case-context-bar")).toContainText("Completed");

  await role(page, "finance");
  await page.goto(analysisUrl);
  await page.getByRole("button", { name: "4. Submit" }).click();
  await page.getByText("View sources and activity").click();
  await expect(page.locator(".case-context-bar")).toContainText("Approved");
  await expect(page.getByRole("region", { name: "Activity" })).toContainText(
    "Submitted for approval",
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

test("other roles cannot prepare investment analyses", async ({ page }) => {
  await page.goto("/");
  for (const value of ["employee", "compliance", "manager"]) {
    await role(page, value);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).not.toContainText("Investment Analysis");
    await page.goto("/investment");
    await expect(
      page.getByRole("heading", {
        name: "Investment Analysis is prepared by Finance.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Prepare Analysis" }),
    ).toHaveCount(0);
    await page.goto("/");
  }
});
