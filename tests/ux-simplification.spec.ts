import { expect, test } from "@playwright/test";

test("five demo personas, simple launchpad, and role-aware Work", async ({
  page,
}) => {
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: "Demo role" });
  await expect(selector.locator("option")).toHaveCount(5);
  await expect(selector).not.toContainText("Nadia Rahman");
  await expect(selector).not.toContainText("Sinta Mahardika");
  await expect(page.getByText("prototype only")).toBeVisible();
  for (const role of [
    "employee",
    "manager",
    "compliance",
    "finance",
    "governance",
  ]) {
    await selector.selectOption(role);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toContainText("Work");
    await expect(nav).toContainText("Knowledge Library");
    await expect(nav).not.toContainText("Impact");
    await expect(nav).not.toContainText("Reviews / Approvals");
    await expect(
      page.getByRole("region", { name: "Needs your attention" }),
    ).toBeVisible();
    await expect(page.locator(".home-launchpad table")).toHaveCount(1);
    await nav.getByRole("link", { name: "Work", exact: true }).click();
    if (role === "employee")
      await expect(
        page.getByRole("link", { name: "Needs My Decision" }),
      ).toHaveCount(0);
    else
      await expect(
        page.getByRole("link", { name: "Needs My Decision" }),
      ).toBeVisible();
    await page.goto("/");
  }
});

test("Ask starts with question and keeps search settings collapsed", async ({
  page,
}) => {
  await page.goto("/ask");
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toBeVisible();
  const options = page.locator("details.search-options");
  await expect(options).not.toHaveAttribute("open", "");
  await options.locator("summary").click();
  await expect(
    page.getByRole("combobox", { name: "Question source" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enable WebSearch" }),
  ).toBeVisible();
});
