import { expect, test, type Page } from "@playwright/test";

async function askCase(page: Page, question: string, source?: string) {
  await page.goto("/ask");
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toBeEnabled();
  if (source)
    await page
      .getByRole("combobox", { name: "Question source" })
      .selectOption(source);
  await page.getByRole("textbox", { name: "Your question" }).fill(question);
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await page.getByRole("link", { name: "Create case", exact: true }).click();
  await page.getByRole("button", { name: "Create case", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start workflow", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start workflow", exact: true })
    .click();
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete task", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Approval Panel" }),
  ).toBeVisible();
}

async function role(page: Page, value: string) {
  await page.getByRole("combobox", { name: "Demo role" }).selectOption(value);
  await expect(
    page.getByRole("region", { name: "Approval Panel" }),
  ).toBeVisible();
}

test("verified answer becomes a persistent case, task, approval and completion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await askCase(page, "How many annual leave days do I get?", "leave-policy");
  await expect(
    page.getByRole("region", { name: "Workflow timeline" }),
  ).toContainText("Manager decision");
  await expect(
    page.getByRole("region", { name: "Case audit trail" }),
  ).toContainText("task completed");
  const url = page.url();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Approval Panel" }),
  ).toContainText("manager");
  await role(page, "manager");
  await page
    .getByRole("combobox", { name: "Decision action" })
    .selectOption("approve");
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill("Current leave policy reviewed.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".case-context-bar")).toContainText("completed");
  await page.goto(url);
  await expect(page.locator(".case-context-bar")).toContainText("completed");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  await expect(
    page.getByRole("region", { name: "Case audit trail" }),
  ).toContainText("approval approved");
  await page.locator(".case-evidence .source-reference").first().click();
  await expect(
    page.getByRole("dialog", { name: "Source Panel" }),
  ).toContainText("15 days");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("missing evidence request is persisted and resumes only after a real source is attached", async ({
  page,
}) => {
  await page.goto("/cases?new=1");
  await page
    .getByRole("textbox", { name: "Case title", exact: true })
    .fill("Collect current leave policy evidence");
  await page.getByRole("button", { name: "Create case", exact: true }).click();
  await page
    .getByRole("button", { name: "Start workflow", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete task", exact: true })
    .click();
  await expect(page.locator(".case-context-bar")).toContainText(
    "waiting for evidence",
  );
  await role(page, "manager");
  await page
    .getByRole("combobox", { name: "Decision action" })
    .selectOption("request-evidence");
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill("Current leave policy must be inspected.");
  await page
    .getByRole("textbox", { name: "Required evidence" })
    .fill("Approved leave policy section");
  await page
    .getByRole("button", { name: "Request evidence", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  await page.getByText("Attach source evidence", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Evidence document" })
    .selectOption("leave-policy");
  const section = page.getByRole("combobox", { name: "Evidence section" });
  await expect(section.locator("option").nth(1)).toBeAttached();
  await section.selectOption({ index: 1 });
  await page
    .getByRole("combobox", { name: "Evidence requirement" })
    .selectOption({ index: 1 });
  await page
    .getByRole("button", { name: "Attach evidence", exact: true })
    .click();
  await expect(page.locator(".reliability-status")).toHaveText("VERIFIED");
  await page
    .getByRole("button", { name: "Resume workflow", exact: true })
    .click();
  await role(page, "manager");
  await page
    .getByRole("combobox", { name: "Decision action" })
    .selectOption("approve");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".case-context-bar")).toContainText("completed");
});

test("conflicting knowledge routes to SME and preserves reliability after decision", async ({
  page,
}) => {
  await askCase(page, "How often are access rights reviewed?");
  await expect(
    page.getByRole("region", { name: "Approval Panel" }),
  ).toContainText("sme");
  await role(page, "sme");
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill(
      "Conflicting intervals inspected; record the review outcome for knowledge owner reconciliation.",
    );
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".case-context-bar")).toContainText("completed");
  await expect(page.locator(".reliability-status")).toHaveText(
    "REVIEW REQUIRED",
  );
});

test("requester cannot approve a material decision, including direct API calls", async ({
  page,
  request,
}) => {
  await askCase(page, "How many annual leave days do I get?", "leave-policy");
  await expect(
    page.getByRole("combobox", { name: "Decision action" }),
  ).toHaveCount(0);
  const id = new URL(page.url()).searchParams.get("case")!;
  const current = await (
    await request.get(`http://127.0.0.1:8001/api/cases/${id}`, {
      headers: { "X-User-Id": "employee" },
    })
  ).json();
  const approval = current.approvals.find(
    (item: { status: string }) => item.status === "PENDING",
  );
  const denied = await request.post(
    `http://127.0.0.1:8001/api/approvals/${approval.id}/approve`,
    {
      headers: { "X-User-Id": "employee" },
      data: { expected_revision: current.revision },
    },
  );
  expect(denied.status()).toBe(403);
  await page.reload();
  await expect(page.locator(".case-context-bar")).toContainText(
    "waiting for review",
  );
});

test("contradictory simultaneous decisions accept one and safely reject stale state", async ({
  page,
  request,
}) => {
  await askCase(page, "How many annual leave days do I get?", "leave-policy");
  const id = new URL(page.url()).searchParams.get("case")!;
  const current = await (
    await request.get(`http://127.0.0.1:8001/api/cases/${id}`, {
      headers: { "X-User-Id": "manager" },
    })
  ).json();
  const approval = current.approvals.find(
    (item: { status: string }) => item.status === "PENDING",
  );
  const responses = await Promise.all(
    ["approve", "reject"].map((action) =>
      request.post(
        `http://127.0.0.1:8001/api/approvals/${approval.id}/${action}`,
        {
          headers: { "X-User-Id": "manager" },
          data: {
            expected_revision: current.revision,
            reason: "Concurrent authority decision test.",
          },
        },
      ),
    ),
  );
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 409,
  ]);
  const result = await (
    await request.get(`http://127.0.0.1:8001/api/cases/${id}`, {
      headers: { "X-User-Id": "manager" },
    })
  ).json();
  expect(
    result.activity.filter((event: { event_type: string }) =>
      ["approval_approved", "approval_rejected"].includes(event.event_type),
    ),
  ).toHaveLength(1);
});

test("escalation reaches Governance and override requires a reason", async ({
  page,
}) => {
  await askCase(page, "How many annual leave days do I get?", "leave-policy");
  await role(page, "manager");
  await page
    .getByRole("combobox", { name: "Decision action" })
    .selectOption("escalate");
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill("Request Governance exception review.");
  await page.getByRole("button", { name: "Escalate", exact: true }).click();
  await role(page, "governance");
  await page
    .getByRole("combobox", { name: "Decision action" })
    .selectOption("override");
  await expect(
    page.getByRole("textbox", { name: "Decision reason" }),
  ).toHaveAttribute("required", "");
  await page.getByRole("button", { name: "Override", exact: true }).click();
  await expect(page.locator(".case-context-bar")).toContainText(
    "waiting for review",
  );
  await page
    .getByRole("textbox", { name: "Decision reason" })
    .fill("Current approved evidence reviewed; exception decision recorded.");
  await page.getByRole("button", { name: "Override", exact: true }).click();
  await expect(page.locator(".case-context-bar")).toContainText("completed");
  await expect(
    page.getByRole("region", { name: "Case audit trail" }),
  ).toContainText("override performed");
});
