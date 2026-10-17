import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [],
  runs = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("/api/copilotkit/agent/workspace/run"))
    runs.push(r.url());
});
try {
  const health = await fetch("http://127.0.0.1:8000/api/health").then((r) =>
    r.json(),
  );
  if (
    health.inference_provider !== "ollama-grounded-v1" ||
    health.retrieval_engine !== "llamaindex"
  )
    throw Error("Real RAG/AI is not active");
  await page.goto("http://127.0.0.1:3000/ask");
  await page.locator(".intent-rail[data-agent-ready='true']").waitFor();
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill(
      "Apa persyaratan autentikasi dua faktor untuk layanan digital menurut POJK 21 Tahun 2023?",
    );
  const waitAnswer = page.waitForResponse(
    (r) => r.url().endsWith("/api/ask") && r.request().method() === "POST",
    { timeout: 360000 },
  );
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const response = await waitAnswer;
  if (response.status() !== 201) throw Error(await response.text());
  const answer = await response.json();
  if (answer.provider !== "ollama-grounded-v1")
    throw Error("Synthetic answer provider used");
  if (!answer.sources[0]?.section_path.includes("Pasal 9"))
    throw Error("Exact authentication article was not first");
  if (!answer.answer.toLowerCase().includes("faktor"))
    throw Error("Missing actual authentication answer");
  if (answer.reliability.status !== "REVIEW_REQUIRED")
    throw Error("Guard did not require review");
  await page.locator('[data-response-view="regulation_brief"]').waitFor();
  if (!runs.length) throw Error("CopilotKit/AG-UI was bypassed");
  await page
    .getByRole("button", { name: "Open citation 1", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Open official OJK PDF" }).waitFor();
  await mkdir("artifacts/screenshots/ojk", { recursive: true });
  await page.screenshot({
    path: "artifacts/screenshots/ojk/copilotkit-rag-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile overflow");
  await page.screenshot({
    path: "artifacts/screenshots/ojk/copilotkit-rag-mobile.png",
  });
  const denied = await fetch("http://127.0.0.1:8000/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": "employee" },
    body: JSON.stringify({
      question: "Proposal A investment",
      document_ids: ["proposal-a"],
    }),
  }).then((r) => r.json());
  if (denied.sources.length) throw Error("Restricted source leakage");
  if (errors.length) throw Error(JSON.stringify(errors));
  const result = {
    health,
    answer,
    copilotkit_runs: runs.length,
    page_errors: errors,
    denied_sources: denied.sources.length,
  };
  await mkdir(".runtime/ojk", { recursive: true });
  await writeFile(
    ".runtime/ojk/production-verification.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      provider: answer.provider,
      answer: answer.answer,
      top_source: answer.sources[0].section_path,
      copilotkit_runs: runs.length,
      reliability: answer.reliability.status,
      errors,
    }),
  );
} finally {
  await browser.close();
}
