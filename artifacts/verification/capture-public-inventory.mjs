import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".runtime/playwright");
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("artifacts/demo/screenshots", { recursive: true });
await page.goto("http://127.0.0.1:3000/knowledge");
await page.getByRole("combobox", { name: "Viewing as" }).selectOption("governance");
for (const [domain, title, path] of [
  ["Finance", /FDIC.*Managing Cash Flow/, "10-public-finance.png"],
  ["Operations", /NIST.*Cybersecurity Framework/, "11-public-operations.png"],
  ["People", /ILO.*Working from Home/, "12-public-people.png"],
]) {
  await page.getByRole("combobox", { name: "Knowledge domain" }).selectOption(domain);
  await page.getByRole("button", { name: title }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `artifacts/demo/screenshots/${path}`, animations: "disabled" });
  console.log(`${domain}: ${path}`);
}
console.log(JSON.stringify({ pageErrors: errors }));
await browser.close();
