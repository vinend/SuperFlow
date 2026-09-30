import { expect, test } from "@playwright/test";

test("Compliance collects investigation evidence before escalating to checker", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/investigations");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("compliance");

  await expect(
    page.getByRole("heading", {
      name: "Unusual outbound transfer review",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Investigation Review" }),
  ).toBeVisible();
  await expect(
    page.getByText("3 of 5 required checks completed."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Escalate to checker" }),
  ).toBeDisabled();

  await page
    .getByRole("button", { name: "Simulate evidence collection" })
    .click();
  await expect(
    page.getByText("5 of 5 required checks completed."),
  ).toBeVisible();
  await expect(
    page.getByText("No exact match · one low-confidence"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Escalate to checker" }),
  ).toBeEnabled();

  await page.getByRole("tab", { name: "Evidence" }).click();
  const evidence = page.getByRole("tabpanel", { name: "Evidence" });
  await expect(
    evidence.getByText("Supporting documents", { exact: true }),
  ).toBeVisible();
  await expect(
    evidence.getByText("Optional attachments are appended"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Escalate to checker" }).click();
  await expect(
    page.getByText("Waiting for checker", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Activity" })).toContainText(
    "Escalated to checker",
  );
  await expect(page.locator("body")).not.toContainText(
    /WorkflowRun|GuardResult|Case ID|Phase 7/,
  );
  expect(errors).toEqual([]);
});
