import { expect, test } from "@playwright/test";

test("governance composes approved QCD views from recorded activity", async ({
  page,
  request,
}) => {
  const response = await request.post("http://127.0.0.1:8001/api/ask", {
    headers: { "X-User-Id": "governance" },
    data: {
      question: "How many annual leave days do employees receive?",
      domain: "People",
      document_ids: ["leave-policy"],
      include_outdated: false,
    },
  });
  expect(response.status()).toBe(201);

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("governance");
  await page.getByRole("link", { name: "Impact", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Impact", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Impact across quality, capacity, and delivery",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quality", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".controlled-impact-workspace")).toContainText(
    "Illustrative simulation",
  );
  await expect(page.locator(".controlled-impact-workspace")).toContainText(
    "not a claim of realized savings",
  );

  await page.getByRole("button", { name: "What is slowing delivery?" }).click();
  await expect(
    page.getByRole("heading", { name: "How work is moving" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Delivery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cost / Capacity" }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /WorkflowRun|GuardResult|AuditEvent|Phase 6/,
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

test("employee has no Impact navigation or aggregate data", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).not.toContainText("Impact");
  await page.goto("/impact");
  await expect(
    page.getByRole("heading", {
      name: "Impact is available to review and control roles.",
    }),
  ).toBeVisible();
  await expect(page.locator(".controlled-impact-workspace")).toHaveCount(0);
});
