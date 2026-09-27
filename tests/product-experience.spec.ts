import { expect, test } from "@playwright/test";

const navigation: Record<string, string[]> = {
  employee: ["Home", "Ask SuperFlow", "Knowledge", "My Work"],
  manager: [
    "Home",
    "Ask SuperFlow",
    "Knowledge",
    "My Work",
    "Reviews / Approvals",
  ],
  sme: ["Home", "Ask SuperFlow", "Knowledge", "My Work", "Reviews"],
  compliance: [
    "Home",
    "Ask SuperFlow",
    "Knowledge",
    "Regulatory Review",
    "My Work",
    "Reviews / Approvals",
  ],
  finance: [
    "Home",
    "Ask SuperFlow",
    "Knowledge",
    "My Work",
    "Reviews / Approvals",
  ],
  governance: ["Home", "Knowledge", "My Work", "Reviews / Approvals"],
};
for (const [role, labels] of Object.entries(navigation)) {
  test(`${role} sees role-aware navigation without unavailable or internal modules`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.getByRole("combobox", { name: "Demo role" }).selectOption(role);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link")).toHaveText(labels);
    await expect(page.locator(".sidebar")).not.toContainText(
      /Phase|Later|Decision Center|Workflows|Cases|Analytics/,
    );
    await page.getByRole("link", { name: "My Work", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My Work", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
      role,
    );
    await expect(
      page.getByRole("heading", { name: "My Work", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
    await expect(dialog.getByRole("navigation").getByRole("link")).toHaveText(
      labels,
    );
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
test("review queue hides requester-only approvals and employee direct route has no decision controls", async ({
  page,
  request,
}) => {
  const headers = { "X-User-Id": "employee" };
  const answer = await (
    await request.post("http://127.0.0.1:8001/api/ask", {
      headers,
      data: {
        question: "How many annual leave days do I get?",
        document_ids: ["leave-policy"],
      },
    })
  ).json();
  let item = await (
    await request.post("http://127.0.0.1:8001/api/cases", {
      headers,
      data: { title: "Annual Leave Review", question_run_id: answer.id },
    })
  ).json();
  item = await (
    await request.post(
      "http://127.0.0.1:8001/api/workflows/generic-review-v1/start",
      { headers, data: { case_id: item.id, expected_revision: item.revision } },
    )
  ).json();
  item = await (
    await request.post(
      `http://127.0.0.1:8001/api/tasks/${item.workflow.tasks[0].id}/complete`,
      { headers, data: { expected_revision: item.revision } },
    )
  ).json();
  const approval = item.approvals.find(
    (a: { status: string }) => a.status === "PENDING",
  );
  await page.goto(`/decisions?case=${item.id}`);
  await expect(
    page.getByRole("heading", {
      name: "Reviews are available to assigned reviewers.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Decision action" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("manager");
  await expect(
    page.getByRole("region", { name: "Review request" }),
  ).toContainText("Maya Putri");
  await page
    .getByRole("link", { name: "Reviews / Approvals", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Review queue" }),
  ).toContainText("Annual Leave Review");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("compliance");
  await expect(
    page.getByRole("heading", { name: "No reviews need your attention." }),
  ).toBeVisible();
  const denied = await request.post(
    `http://127.0.0.1:8001/api/approvals/${approval.id}/approve`,
    { headers, data: { expected_revision: item.revision } },
  );
  expect(denied.status()).toBe(403);
});
test("blocked Ask offers an explicit information request without authorizing an exception", async ({
  page,
}) => {
  await page.goto("/ask");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Can I reimburse an expense without a receipt?");
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption("expense-sop");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.locator(".reliability-status")).toHaveText("BLOCKED");
  await page
    .getByRole("link", { name: "Request Exception", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Request title", exact: true }),
  ).toHaveValue("Expense Reimbursement Exception");
  const consent = page.getByRole("checkbox");
  await expect(consent).toHaveAttribute("required", "");
  await page
    .getByRole("button", { name: "Submit Request", exact: true })
    .click();
  await expect(
    page.getByRole("form", { name: "Submit request" }),
  ).toBeVisible();
  await consent.check();
  await page
    .getByRole("button", { name: "Submit Request", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Information checked", exact: true })
    .click();
  await expect(page.locator(".case-context-bar")).toContainText(
    "Waiting for information",
  );
  await expect(page.locator(".reliability-status")).toHaveText("BLOCKED");
  await expect(
    page.getByRole("button", { name: "Approve", exact: true }),
  ).toHaveCount(0);
  // Opening a request must not depend on unrelated workspace-wide lists.
  const aggregateLists = /\/api\/(cases|workflow-runs|approvals)$/;
  await page.route(aggregateLists, (route) => route.abort());
  await page.reload();
  await expect(page.locator(".case-context-bar")).toContainText(
    "Waiting for information",
  );
  await expect(page.locator(".reliability-status")).toHaveText("BLOCKED");
  await page.unroute(aggregateLists);
  await page
    .getByRole("link", { name: "My Work", exact: true })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "My Work" })).toContainText(
    "Expense Reimbursement Exception",
  );
  await expect(page.getByRole("region", { name: "My Work" })).toContainText(
    "Provide information",
  );
});
