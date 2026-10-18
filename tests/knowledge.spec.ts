import { expect, test, type Request } from "@playwright/test";

test("compact Ask and repository filters preserve source inspection", async ({
  page,
}) => {
  await page.goto("/ask");
  await page.evaluate(() => localStorage.setItem("superflow.demo-user", "sme"));
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Your question" }),
  ).toBeEnabled();
  await expect(page.locator(".question-history")).toHaveCount(0);
  const composer = await page.locator(".question-form").boundingBox();
  expect(composer!.height).toBeLessThan(120);
  await page.locator("details.search-options > summary").click();
  await expect(
    page.getByRole("combobox", { name: "Question source" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Knowledge Library", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Knowledge domain" })
    .selectOption("People");
  await expect(
    page.getByRole("button", { name: /^Annual Leave Policy/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Incident Reporting SOP/ }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Document status filter" })
    .selectOption("draft");
  await expect(
    page.getByRole("heading", { name: "No matching sources" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Document status filter" })
    .selectOption("active");
  await page
    .getByRole("combobox", { name: "Sort documents" })
    .selectOption("recent");
  await page
    .getByRole("button", { name: /^Annual Leave Policy/ })
    .first()
    .click();
  const detail = page.getByRole("dialog", { name: "Document details" });
  await expect(
    detail.getByRole("heading", { name: "Source content" }),
  ).toBeVisible();
  await expect(detail).toContainText("15 days");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await expect(
    detail.getByRole("button", { name: "Close document details" }),
  ).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
});

test("role-aware knowledge inventory and application navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, Maya" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Work", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Knowledge Library", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Annual Leave Policy/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Workflow Modernization Proposal A/ }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("governance");
  await expect(
    page
      .getByRole("button", { name: /^Workflow Modernization Proposal A/ })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Workflow Modernization Proposal A/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Document details" }),
  ).toContainText("180,000,000");
  await page.keyboard.press("Escape");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  await expect(
    page.getByRole("dialog", { name: "Document details" }),
  ).toHaveCount(0);
  await expect(page.getByText("180,000,000")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Ask returns current citations, Source Panel, historical labels, and saved history", async ({
  page,
}) => {
  await page.goto("/ask");
  if (await page.locator("details.search-options:not([open])").count())
    await page.locator("details.search-options > summary").click();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption("leave-policy");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many annual leave days do I get?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const answer = page.getByRole("region", { name: "Answer Card" });
  await expect(answer).toContainText("15 days");
  await expect(answer).not.toContainText("12 days");
  await page.getByRole("button", { name: "Open citation 1" }).click();
  const panel = page.getByRole("dialog", { name: "Source Panel" });
  await expect(panel).toContainText("v2.0");
  await expect(panel).toContainText("Nadia Rahman");
  await expect(panel).toContainText("Leave entitlement");
  await expect
    .poll(async () => {
      const answerBounds = await answer.boundingBox();
      const panelBounds = await panel.boundingBox();
      return answerBounds!.x + answerBounds!.width - panelBounds!.x;
    })
    .toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Close source panel" }).click();
  await page
    .getByRole("checkbox", { name: /Include historical versions/ })
    .check();
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(answer).toContainText("12 days");
  await page.reload();
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "12 days",
  );
  await page.locator("details.search-options > summary").click();
  await expect(
    page.getByRole("checkbox", { name: /Include historical versions/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Question source" }),
  ).toHaveValue("leave-policy");
  await answer.getByText(/View sources/).click();
  await answer
    .getByRole("button", { name: /Annual Leave Policy.*v1.0/ })
    .first()
    .click();
  await expect(panel).toContainText("outdated version");
  await panel
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Document details" }),
  ).toContainText("12 days");
  await expect(
    page
      .getByRole("combobox", { name: "Inspect version" })
      .locator("option:checked"),
  ).toContainText("v1.0 · outdated");
  await page.getByRole("button", { name: "Close document details" }).click();
  await page.getByRole("button", { name: "Close source panel" }).click();
  await page.reload();
  await page.getByText("Recent questions").click();
  await expect(
    page
      .getByRole("button", { name: /How many annual leave days do I get/ })
      .first(),
  ).toBeVisible();
});

test("unsupported questions fail without fabricated evidence and source state clears on role switch", async ({
  page,
}) => {
  await page.goto("/ask");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("quasar neutrino spectrum");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "No supporting sources",
  );
  await expect(page.getByRole("button", { name: /Open citation/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("finance");
  if (await page.locator("details.search-options:not([open])").count())
    await page.locator("details.search-options > summary").click();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption("proposal-a");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What is Proposal A initial investment?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "180,000,000",
  );
  await page.getByRole("button", { name: "Open citation 1" }).click();
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  await expect(page.getByRole("dialog", { name: "Source Panel" })).toHaveCount(
    0,
  );
  await expect(page.getByText("180,000,000")).toHaveCount(0);
});

test("governance uploads, edits metadata, versions, reindexes, and retrieves the new active source", async ({
  page,
}) => {
  const title = `E2E Remote Working ${Date.now()}`;
  await page.goto("/knowledge");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("governance");
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page.getByLabel("Document title", { exact: true }).fill(title);
  await page.locator('input[name="file"]').setInputFiles({
    name: "remote.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Remote work\nRemote work is permitted three days each week.",
    ),
  });
  await page
    .getByRole("button", { name: "Upload document", exact: true })
    .click();
  const details = page.getByRole("dialog", { name: "Document details" });
  await expect(details).toContainText("three days");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveValue(
    "governance",
  );
  await expect(details).toContainText("three days");
  await details.getByRole("button", { name: "Edit metadata" }).click();
  await page
    .getByLabel("Document title", { exact: true })
    .fill(`${title} Updated`);
  await page.getByRole("button", { name: "Save metadata" }).click();
  await expect(details).toContainText(`${title} Updated`);
  await details
    .getByRole("button", { name: "Add version", exact: true })
    .click();
  await page.getByLabel("Version label", { exact: true }).fill("2.0");
  await page.locator('input[name="file"]').setInputFiles({
    name: "remote-v2.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Remote work\nRemote work is permitted four days each week.",
    ),
  });
  await page.getByRole("button", { name: "Add version", exact: true }).click();
  await expect(details).toContainText("four days");
  await details.getByRole("button", { name: "Re-index", exact: true }).click();
  await expect(details).toContainText("Re-indexed 2 chunks");
  const versionOptions = await page
    .getByRole("combobox", { name: "Inspect version" })
    .locator("option")
    .allTextContents();
  expect(
    versionOptions.some((option) => option.includes("v1.0 · outdated")),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Close document details" }).click();
  // Governance navigation is control-focused; its existing Ask route remains available.
  await page.goto("/ask");
  if (await page.locator("details.search-options:not([open])").count())
    await page.locator("details.search-options > summary").click();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption({ label: `${title} Updated` });
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("How many days of remote work are permitted each week?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "four days",
  );
  await expect(
    page.getByRole("region", { name: "Answer Card" }),
  ).not.toContainText("three days");
});

test("mobile navigation and actionable API connection failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Knowledge Library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Knowledge Library" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("governance");
  await expect(
    page
      .getByRole("button", { name: /^Workflow Modernization Proposal A/ })
      .first(),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBeTruthy();
  await page.route("**/api/users", (route) => route.abort());
  await page.reload();
  await expect(
    page.getByText("Cannot reach the knowledge API.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toBeVisible();
});

test("document dialogs support keyboard focus, historical refresh, and source-scoped Ask", async ({
  page,
}) => {
  await page.goto("/knowledge");
  const opener = page
    .getByRole("button", { name: /^Annual Leave Policy/ })
    .first();
  await opener.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog", { name: "Document details" });
  await expect(detail).toBeVisible();
  await expect
    .poll(() =>
      detail.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBeTruthy();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(
      await detail.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBeTruthy();
  }
  await page
    .getByRole("combobox", { name: "Inspect version" })
    .selectOption({ label: "v1.0 · outdated · 1 Jan 2024" });
  await expect(detail).toContainText("12 days");
  await page.reload();
  await expect(detail).toContainText("12 days");
  await expect(
    page
      .getByRole("combobox", { name: "Inspect version" })
      .locator("option:checked"),
  ).toContainText("v1.0");
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await opener.focus();
  await page.keyboard.press("Enter");
  await detail.getByRole("button", { name: "Ask about this source" }).click();
  await expect(
    page.getByRole("heading", { name: "Ask SuperFlow", exact: true }),
  ).toBeVisible();
  await page.locator("details.search-options > summary").click();
  await expect(
    page.getByRole("combobox", { name: "Question source" }),
  ).toHaveValue("leave-policy");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("annual leave days");
  await page.getByRole("textbox", { name: "Your question" }).press("Enter");
  await expect(page.getByRole("region", { name: "Answer Card" })).toContainText(
    "15 days",
  );
  await page.getByRole("button", { name: "Open citation 1" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Source Panel" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Open citation 1" }),
  ).toBeFocused();
});

test("mobile Source Panel is a keyboard-accessible sheet without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ask");
  if (await page.locator("details.search-options:not([open])").count())
    await page.locator("details.search-options > summary").click();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption("leave-policy");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("annual leave days");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await page.getByRole("button", { name: "Open citation 1" }).click();
  const panel = page.getByRole("dialog", { name: "Source Panel" });
  await expect(panel).toHaveAttribute("aria-modal", "true");
  await expect(panel).toContainText("15 days");
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    expect(
      await panel.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBeTruthy();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open citation 1" }),
  ).toBeFocused();
});

test("a delayed Ask response cannot restore another role's content or URL context", async ({
  page,
}) => {
  await page.goto("/ask");
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("finance");
  if (await page.locator("details.search-options:not([open])").count())
    await page.locator("details.search-options > summary").click();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption("proposal-a");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  await page.route("**/api/ask", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    fetched();
    await gate;
    await route.fulfill({ response });
  });
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("Proposal A initial investment");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await ready;
  // Switching identities now aborts the old request. Both cancellation and a
  // response arriving just before cancellation must keep the new role clean.
  const requestEnded = new Promise<void>((resolve) => {
    const ended = (request: Request) => {
      if (!request.url().endsWith("/api/ask") || request.method() !== "POST")
        return;
      page.off("requestfinished", ended);
      page.off("requestfailed", ended);
      resolve();
    };
    page.on("requestfinished", ended);
    page.on("requestfailed", ended);
  });
  await page
    .getByRole("combobox", { name: "Demo role" })
    .selectOption("employee");
  const url = page.url();
  release();
  await requestEnded;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.locator("details.search-options > summary").click();
  await expect(
    page.getByRole("combobox", { name: "Question source" }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("combobox", { name: "Question source" })
      .locator('option[value="proposal-a"]'),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Answer Card" })).toHaveCount(
    0,
  );
  await expect(page.getByText("180,000,000")).toHaveCount(0);
  expect(page.url()).toBe(url);
});
