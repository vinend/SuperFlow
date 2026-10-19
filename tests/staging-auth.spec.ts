import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("password sign-in persists, header spoofing fails, and logout revokes access", async ({
  page,
}) => {
  await page.goto("/investment");
  await page
    .getByLabel("Email", { exact: true })
    .fill("finance@superflow.example");
  await page.getByLabel("Password", { exact: true }).fill("incorrect password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toContainText(
    "Sign-in failed",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("staging browser test password 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Demo role" })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  const spoof = await page.request.get("/api/backend/api/auth/me", {
    headers: { "X-User-Id": "governance" },
  });
  expect((await spoof.json()).id).toBe("finance");
  await page.screenshot({
    path: "artifacts/screenshots/staging-auth-finance.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/backend/api/documents", {
        headers: { "X-User-Id": "governance" },
      })
    ).status(),
  ).toBe(401);
});

test("authenticated analyst imports records through the investigation UI", async ({
  page,
}) => {
  await page.goto("/investigations");
  await page
    .getByLabel("Email", { exact: true })
    .fill("compliance@superflow.example");
  await page
    .getByLabel("Password", { exact: true })
    .fill("staging browser test password 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  const panel = page.getByRole("region", {
    name: "Load investigation",
  });
  if (!(await panel.isVisible()))
    await page.getByText("Load another investigation", { exact: true }).click();
  await panel
    .getByText("Import investigation", { exact: true })
    .first()
    .click();
  const intake = JSON.parse(
    readFileSync("apps/web/public/samples/investigation-intake.json", "utf8"),
  );
  intake.alert_reference = `AUTH-E2E-${Date.now()}`;
  await panel.getByLabel("Investigation file").setInputFiles({
    name: "intake.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(intake)),
  });
  await panel
    .getByRole("button", { name: "Import investigation", exact: true })
    .click();
  await expect(
    page.getByText(intake.alert_reference, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Sample Customer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("IDR 150,000,000", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/staging-investigation-import.png",
    fullPage: true,
  });
});
