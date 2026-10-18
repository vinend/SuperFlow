import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const screenshots = join(
  process.cwd(),
  "artifacts",
  "screenshots",
  "generative-workspace",
);

// Domain previews may create their existing idempotent review/analysis records.
// Restore the deterministic shared E2E seed before older journeys run.
test.afterAll(() => {
  execFileSync(process.execPath, ["scripts/prepare-e2e.mjs"], {
    stdio: "pipe",
  });
});

async function capture(page: Page, name: string, fullPage = false) {
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({
    path: join(screenshots, name),
    animations: "disabled",
    fullPage,
  });
}

async function ask(page: Page, role: string, prompt: string) {
  await page.goto("/ask");
  if (role !== "employee")
    await page.getByRole("combobox", { name: "Demo role" }).selectOption(role);
  await expect(
    page.locator(".intent-rail[data-agent-ready='true']"),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("textbox", { name: "Your question" }).fill(prompt);
  await page.getByRole("button", { name: "Ask question" }).click();
}

test("employee knowledge prompt uses AG-UI and grounded AnswerCard", async ({
  page,
}) => {
  const runs: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/copilotkit/agent/workspace/run"))
      runs.push(request.url());
  });
  await ask(page, "employee", "How many annual leave days do I get?");
  const workspace = page.getByRole("region", { name: "Generated workspace" });
  await expect(
    workspace.getByRole("heading", { name: "Knowledge answer" }),
  ).toBeVisible();
  await expect(
    workspace.getByText("15 days", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    workspace.getByText("VERIFIED", { exact: false }).first(),
  ).toBeVisible();
  await workspace.getByText(/View sources/).click();
  await expect(
    workspace.getByRole("button", { name: /Annual Leave Policy v2.0/ }).first(),
  ).toBeVisible();
  await workspace.getByRole("button", { name: "Open citation 1" }).click();
  await expect(page.getByRole("dialog", { name: /source/i })).toBeVisible();
  await capture(page, "employee-knowledge.png");
  expect(runs.length).toBeGreaterThan(0);
});

test("compliance prompt opens the existing regulatory comparison", async ({
  page,
}) => {
  await ask(page, "compliance", "What changed in the latest regulation?");
  const workspace = page.getByRole("region", { name: "Generated workspace" });
  await expect(
    workspace
      .getByRole("heading", { name: "Regulatory Review", exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    workspace.getByRole("region", { name: "Regulation comparison" }),
  ).toContainText("every 6 months");
  await capture(page, "compliance-regulatory.png");
});

test("finance prompt opens source backed investment analysis", async ({
  page,
}) => {
  await ask(page, "finance", "Analyze proposal A.");
  const workspace = page.getByRole("region", { name: "Generated workspace" });
  await expect(
    workspace
      .getByRole("heading", { name: "Investment Analysis", exact: true })
      .first(),
  ).toBeVisible();
  await workspace.getByRole("button", { name: "Review assumptions" }).click();
  await expect(
    workspace.getByRole("heading", { name: "Source-backed assumptions" }),
  ).toBeVisible();
  await capture(page, "finance-investment.png", true);
});

test("compliance prompt opens persisted investigation", async ({ page }) => {
  await ask(page, "compliance", "Investigate alert AML-2026-001.");
  const workspace = page.getByRole("region", { name: "Generated workspace" });
  await expect(
    workspace
      .getByRole("heading", { name: /Investigation Review.*AML-2026-001/ })
      .first(),
  ).toBeVisible();
  await expect(
    workspace.getByRole("region", { name: "Evidence collection" }),
  ).toBeVisible();
  await capture(page, "compliance-investigation.png", true);
});

test("Impact quality prompt uses existing Impact composition", async ({
  page,
}) => {
  await ask(page, "manager", "How many annual leave days do I get?");
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "15 days",
  );
  await ask(page, "manager", "Where does reliability need attention?");
  const workspace = page.getByRole("region", { name: "Generated workspace" });
  await expect(
    workspace.getByRole("heading", { name: "Impact", exact: true }).first(),
  ).toBeVisible();
  await expect(
    workspace.getByText(/quality|reliability/i).first(),
  ).toBeVisible();
  await capture(page, "impact-quality.png");
});

test("My Work and Reviews prompts use existing action data", async ({
  page,
}) => {
  await ask(page, "manager", "What do I need to do?");
  const workspace = page.getByRole("region", { name: "Generated workspace" });
  await expect(
    workspace.getByRole("heading", { name: "My Work", exact: true }).first(),
  ).toBeVisible();
  await ask(page, "manager", "What needs my approval?");
  await expect(
    workspace
      .getByRole("heading", { name: "Reviews / Approvals", exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    workspace.getByRole("heading", { name: "Needs your decision" }),
  ).toBeVisible();
  await capture(page, "manager-reviews.png");
});

test("unauthorized prompt reveals no restricted investigation data", async ({
  page,
}) => {
  await ask(page, "finance", "Investigate alert AML-2026-001.");
  await expect(
    page.getByRole("status", { name: "Workspace unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Evidence collection" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /Investigation Review.*AML-2026-001/ }),
  ).toHaveCount(0);
  await capture(page, "unauthorized-request.png");
});

test("mobile generated workspace remains within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ask(page, "employee", "How many annual leave days do I get?");
  await expect(
    page
      .getByRole("region", { name: "Generated workspace" })
      .getByText(/15 days/)
      .first(),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await capture(page, "mobile-generative-workspace.png", true);
});

test("role change clears generated Impact data and reauthorizes", async ({
  page,
}) => {
  await ask(page, "manager", "Where does reliability need attention?");
  await expect(
    page
      .getByRole("region", { name: "Generated workspace" })
      .getByRole("heading", { name: "Impact", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  await expect(
    page.getByRole("heading", { name: "Tell SuperFlow what you need." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Generated workspace" })
      .getByText("Quality", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Where does reliability need attention?");
  await page.getByRole("button", { name: "Ask question" }).click();
  await expect(
    page.getByRole("status", { name: "Workspace unavailable" }),
  ).toBeVisible();
});

test("AG-UI outage falls back to approved deterministic routing", async ({
  page,
}) => {
  await page.route("**/api/copilotkit/agent/workspace/run", (route) =>
    route.abort(),
  );
  await ask(page, "employee", "How many annual leave days do I get?");
  await expect(
    page
      .getByRole("region", { name: "Generated workspace" })
      .getByText(/15 days/)
      .first(),
  ).toBeVisible();
});

test("material approval prompt only opens review UI", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/approvals\/[^/]+\/(approve|override|reject)/.test(request.url())
    )
      mutations.push(request.url());
  });
  await ask(page, "manager", "Approve this investment.");
  await expect(
    page
      .getByRole("region", { name: "Generated workspace" })
      .getByRole("heading", { name: "Reviews / Approvals" }),
  ).toBeVisible();
  expect(mutations).toHaveLength(0);
});

test("investigation evidence intent selects existing evidence tab", async ({
  page,
}) => {
  await ask(page, "compliance", "Show me the evidence for AML-2026-003.");
  await expect(
    page.getByRole("heading", { name: /Investigation Review.*AML-2026-003/ }),
  ).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: /evidence/i })).toContainText(
    "Evidence and provenance",
  );
});
