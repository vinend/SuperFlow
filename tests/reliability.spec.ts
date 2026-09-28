import { expect, test, type Page } from "@playwright/test";

async function ask(
  page: Page,
  question: string,
  source?: string,
  historical = false,
) {
  await page.goto("/ask");
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toBeEnabled();
  if (source)
    await page
      .getByRole("combobox", { name: "Question source" })
      .selectOption(source);
  if (historical)
    await page
      .getByRole("checkbox", { name: /Include historical versions/ })
      .check();
  await page.getByRole("textbox", { name: "Your question" }).fill(question);
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const guard = page.getByRole("region", { name: "SuperFlow Guard" });
  await expect(guard).toBeVisible();
  return guard;
}

test("VERIFIED current policy has exact evidence, checks and persisted reliability", async ({
  page,
}) => {
  const guard = await ask(
    page,
    "How many annual leave days do I get?",
    "leave-policy",
  );
  await expect(guard.locator(".reliability-status")).toHaveText("VERIFIED");
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "15 days",
  );
  await guard.locator(".evidence-checklist summary").click();
  await expect(guard.locator(".evidence-state").first()).toContainText(
    "available",
  );
  await guard.locator(".evidence-citation").first().click();
  await expect(
    page.getByRole("dialog", { name: "Source Panel" }),
  ).toContainText("Answer reliability: VERIFIED");
  await page.keyboard.press("Escape");
  await guard.locator(".guard-checks summary").focus();
  await page.keyboard.press("Enter");
  await expect(guard.locator(".guard-checks")).toContainText(
    "Every answer extract exactly matches",
  );
  await expect(guard.locator(".guard-checks")).toContainText(
    "Not applicable: this context involves no calculation",
  );
  await page.reload();
  await expect(guard.locator(".reliability-status")).toHaveText("VERIFIED");
});

test("OUTDATED historical result exposes the actual active replacement", async ({
  page,
}) => {
  const guard = await ask(
    page,
    "annual leave days historical v1",
    "leave-policy",
    true,
  );
  await expect(guard.locator(".reliability-status")).toHaveText("OUTDATED");
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "12 days",
  );
  await guard.getByRole("button", { name: /Open active replacement/ }).click();
  const detail = page.getByRole("dialog", { name: "Document details" });
  await expect(detail).toContainText("15 days");
  await expect(
    page
      .getByRole("combobox", { name: "Inspect version" })
      .locator("option:checked"),
  ).toContainText("v2.0 · active");
});

test("ACCESS RESTRICTED returns safe guidance with no citations or restricted content", async ({
  page,
  request,
}) => {
  const guard = await ask(page, "What is the investment approval authority?");
  await expect(guard.locator(".reliability-status")).toHaveText(
    "ACCESS RESTRICTED",
  );
  await expect(page.getByRole("button", { name: /Open citation/ })).toHaveCount(
    0,
  );
  await expect(page.locator(".source-reference")).toHaveCount(0);
  await expect(
    page.getByText("Investment Approval Authority", { exact: true }),
  ).toHaveCount(0);
  await expect(guard).toContainText("unavailable to your role");
  await page.reload();
  await expect(guard.locator(".reliability-status")).toHaveText(
    "ACCESS RESTRICTED",
  );
  const docs = await request.get(
    "http://127.0.0.1:8001/api/documents/approval-policy",
    { headers: { "X-User-Id": "employee" } },
  );
  expect(docs.status()).toBe(404);
});

test("BLOCKED missing receipt exception authority stops the conclusion", async ({
  page,
}) => {
  const guard = await ask(
    page,
    "Can I reimburse an expense without a receipt?",
    "expense-sop",
  );
  await expect(guard.locator(".reliability-status")).toHaveText("BLOCKED");
  await guard.locator(".evidence-checklist summary").click();
  await expect(guard.locator(".evidence-item.missing")).toContainText(
    "Receipt exception authority",
  );
  await expect(guard.locator(".evidence-item.missing")).toContainText(
    "Required",
  );
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "safe conclusion",
  );
  await expect(page.getByRole("button", { name: /Open citation/ })).toHaveCount(
    0,
  );
});

test("REVIEW REQUIRED retains both conflicting references and works on mobile", async ({
  page,
}) => {
  const guard = await ask(page, "How often are access rights reviewed?");
  await expect(guard.locator(".reliability-status")).toHaveText(
    "REVIEW REQUIRED",
  );
  const answer = page.getByRole("region", { name: "Answer Card" });
  await expect(answer).toContainText("12 months");
  await expect(answer).toContainText("6 months");
  await guard.locator(".evidence-checklist summary").click();
  await expect(guard.locator(".evidence-item.conflicting")).toContainText(
    "Access review interval",
  );
  await expect(
    guard.locator(".evidence-item.conflicting .evidence-citation"),
  ).toHaveCount(2);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await guard
    .locator(".evidence-item.conflicting .evidence-citation")
    .first()
    .click();
  const source = page.getByRole("dialog", { name: "Source Panel" });
  await expect(source).toHaveAttribute("aria-modal", "true");
  await expect(source).toContainText("REVIEW REQUIRED");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(guard.locator(".reliability-status")).toHaveText(
    "REVIEW REQUIRED",
  );
});
