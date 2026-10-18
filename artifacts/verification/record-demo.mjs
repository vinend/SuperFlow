import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".runtime/playwright");
const { chromium } = await import("@playwright/test");
const base = "http://127.0.0.1:3000";
const root = "artifacts/demo";
const screenshots = root + "/screenshots";
await mkdir(root + "/raw", { recursive: true });
await mkdir(screenshots, { recursive: true });

const health = await fetch("http://127.0.0.1:8000/api/health").then((r) => r.json());
if (
  health.inference_provider !== "ollama-grounded-v1" ||
  health.retrieval_engine !== "llamaindex"
) {
  throw new Error("Real Qwen and local RAG must be active before recording.");
}
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: root + "/raw", size: { width: 1440, height: 900 } },
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const evidence = {
  model: health.inference_model,
  retrieval: health.retrieval_engine,
  requests: [],
  answers: [],
  captures: [],
  pageErrors: [],
  consoleErrors: [],
  httpErrors: [],
  http4xx: [],
  scenes: [],
};
page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") evidence.consoleErrors.push(message.text().slice(0, 600));
});
page.on("request", (request) => {
  const path = new URL(request.url()).pathname;
  if (/\/api\/(ask|web-search|web-sources|documents|copilotkit)/.test(path)) {
    evidence.requests.push({ method: request.method(), path });
  }
});
page.on("response", (response) => {
  if (response.status() >= 400 && response.status() < 500) {
    evidence.http4xx.push({
      status: response.status(),
      path: new URL(response.url()).pathname,
    });
  }
  if (response.status() >= 500) {
    evidence.httpErrors.push({
      status: response.status(),
      path: new URL(response.url()).pathname,
    });
  }
});

const pause = (ms) => page.waitForTimeout(ms);
let complete = false;
async function capture(name, label, wait = 900) {
  await pause(wait);
  const path = screenshots + "/" + name + ".png";
  await page.screenshot({ path, animations: "disabled" });
  evidence.scenes.push({ label, path, url: page.url() });
  console.log("SCENE " + name + " " + label);
}
async function openAsk() {
  await page.goto(base + "/ask", { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Your question" }).waitFor();
  await page
    .locator(".intent-rail[data-agent-ready='true']")
    .waitFor({ timeout: 30000 });
}
async function ask(question) {
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/ask") &&
      response.request().method() === "POST",
    { timeout: 360000 },
  );
  await page.getByRole("textbox", { name: "Your question" }).fill(question);
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  const response = await pending;
  if (response.status() !== 201) {
    throw new Error("Ask failed: " + response.status() + " " + (await response.text()));
  }
  const answer = await response.json();
  if (answer.provider !== "ollama-grounded-v1") {
    throw new Error("Qwen was not used: " + answer.provider);
  }
  evidence.answers.push({
    run_id: answer.id,
    question,
    provider: answer.provider,
    reliability: answer.reliability.status,
    sources: answer.sources.map((source) => ({
      title: source.title,
      section: source.section_path,
      origin: source.source_origin,
      method: source.extraction_method,
    })),
  });
  return answer;
}
async function citation(name, label) {
  await page.getByRole("button", { name: "Open citation 1" }).first().click();
  await page.getByRole("dialog", { name: "Source Panel" }).waitFor();
  await capture(name, label, 1200);
  await pause(2500);
  await page.keyboard.press("Escape");
}

try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Your workspace" }).waitFor();
  await page.getByText("Loading your next actions...").waitFor({ state: "hidden" });
  if (await page.getByRole("link", { name: "Demo walkthrough" }).count()) {
    throw new Error("Presenter navigation is still exposed.");
  }
  await capture("01-home", "Role-aware product entry without presenter page");
  await pause(3000);

  await openAsk();
  const leave = await ask("How many annual leave days do I get?");
  if (!leave.answer.includes("15 days") || leave.sources[0]?.title !== "Annual Leave Policy") {
    throw new Error("Unrestricted Ask did not cite the relevant policy.");
  }
  await page
    .getByRole("region", { name: "Answer Card" })
    .getByText("AI synthesis from cited sources")
    .waitFor();
  await capture("02-qwen-policy", "Qwen, local RAG, evidence and reliability");
  await pause(5000);
  await citation("03-policy-source", "Current policy version and exact citation");

  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("compliance");
  await page
    .locator(".intent-rail[data-agent-ready='true']")
    .waitFor({ timeout: 30000 });
  await page.getByRole("combobox", { name: "Question domain" }).selectOption("");
  await page.getByRole("combobox", { name: "Question source" }).selectOption("");
  const ojk = await ask(
    "Apa kewajiban autentikasi dua faktor untuk layanan digital bank menurut POJK 21 Tahun 2023?",
  );
  if (
    !ojk.sources[0]?.title.includes("OJK POJK 21 Tahun 2023") ||
    !ojk.sources[0]?.section_path.includes("Pasal 9")
  ) {
    throw new Error("OJK Pasal 9 was not the first source.");
  }
  await capture("04-qwen-ojk", "Qwen grounds the answer in an official OJK PDF");
  await pause(5000);
  await citation("05-ojk-source", "Official PDF page, article and provenance");

  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What changed in the latest regulation?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await page
    .getByRole("region", { name: "Generated workspace" })
    .getByRole("region", { name: "Regulation comparison" })
    .waitFor({ timeout: 60000 });
  await capture("06-generative-comparison", "CopilotKit selects a controlled comparison");
  await pause(4500);

  await page.goto(base + "/knowledge", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("sme");
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page
    .getByLabel("Document title", { exact: true })
    .fill("Scanned travel reimbursement policy");
  await page
    .locator('input[name="file"]')
    .setInputFiles(".runtime/demo-scanned-travel.png");
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/documents") &&
      response.request().method() === "POST",
    { timeout: 300000 },
  );
  await page.getByRole("button", { name: "Upload document" }).click();
  const uploadResponse = await uploaded;
  if (uploadResponse.status() !== 201) {
    throw new Error("OCR upload failed: " + (await uploadResponse.text()));
  }
  const scanned = await uploadResponse.json();
  if (scanned.versions[0].chunks[0]?.extraction_method !== "ocr") {
    throw new Error("Scanned image was not extracted by OCR.");
  }
  evidence.captures.push({ kind: "ocr", document_id: scanned.id });
  await page.getByRole("dialog", { name: "Document details" }).waitFor();
  await capture("07-ocr-upload", "Scanned image becomes indexed knowledge");
  await pause(3000);
  await page.keyboard.press("Escape");

  await openAsk();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption(scanned.id);
  const ocr = await ask(
    "Within how many days must the receipt be submitted under the scanned travel policy?",
  );
  if (
    !/30 days/i.test(ocr.answer) ||
    !ocr.sources.some((source) => source.extraction_method === "ocr")
  ) {
    throw new Error("OCR text did not yield a cited Qwen answer.");
  }
  await capture("08-ocr-answer", "OCR text is searchable and requires review");
  await pause(4000);
  await citation("09-ocr-source", "Original image and OCR provenance");

  await page.goto(base + "/knowledge", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Import website", exact: true }).click();
  const importer = page.getByRole("dialog", { name: "Import website" });
  await importer.getByLabel("Website URL").fill("https://example.com/");
  const previewPending = page.waitForResponse(
    (response) => response.url().endsWith("/api/web-sources/preview"),
    { timeout: 600000 },
  );
  await importer
    .getByRole("button", { name: "Scan website", exact: true })
    .click();
  const previewResponse = await previewPending;
  if (previewResponse.status() !== 200) {
    throw new Error("Puppeteer or vision failed: " + (await previewResponse.text()));
  }
  const preview = await previewResponse.json();
  if (!preview.observations?.length || !preview.screenshots?.length) {
    throw new Error("Website preview has no screenshot or vision result.");
  }
  evidence.captures.push({
    kind: "website",
    url: preview.url,
    vision_model: preview.vision_model,
    screenshot_count: preview.screenshots.length,
  });
  await importer.getByText("Vision scan · screenshot 1").scrollIntoViewIfNeeded();
  await capture("10-website-vision", "Puppeteer capture and Qwen visual observation");
  await pause(4500);
  await importer
    .getByLabel("Document title")
    .fill("Example Domain website reference");
  await importer
    .getByLabel(
      "I reviewed the captured text, screenshots, and vision observations.",
    )
    .check();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/web-sources") &&
      response.request().method() === "POST",
    { timeout: 120000 },
  );
  await importer.getByRole("button", { name: "Save draft source" }).click();
  const saveResponse = await saved;
  if (saveResponse.status() !== 200) {
    throw new Error("Website draft save failed: " + (await saveResponse.text()));
  }
  const website = await saveResponse.json();
  if (website.versions[0]?.status !== "draft") {
    throw new Error("Website source was not saved as a draft.");
  }
  const details = page.getByRole("dialog", { name: "Document details" });
  await details.waitFor();
  await capture("11-website-draft", "Website evidence saved as a governed draft");
  await pause(3000);
  await details
    .getByRole("combobox", { name: "Version status" })
    .selectOption("active");
  await details.getByText("Version status updated.").waitFor({ timeout: 120000 });
  await page.keyboard.press("Escape");

  await openAsk();
  await page
    .getByRole("combobox", { name: "Question source" })
    .selectOption(website.id);
  const websiteAnswer = await ask("What is the Example Domain website intended for?");
  if (
    !websiteAnswer.sources.some(
      (source) => source.extraction_method === "web_capture",
    )
  ) {
    throw new Error("Published website was not retrievable.");
  }
  await capture("12-website-answer", "Website text has Internet and browser provenance");
  await pause(4000);

  await openAsk();
  await page
    .getByRole("button", { name: "Enable WebSearch", exact: true })
    .click();
  await page.getByText("WebSearch options", { exact: true }).click();
  await page
    .getByLabel("Selected result URLs (optional)")
    .fill("https://example.com/");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What does Example Domain say about documentation use?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await page
    .getByRole("region", { name: "Answer activity" })
    .waitFor({ timeout: 15000 });
  await capture("13-live-activity", "Real retrieval, browser and Qwen progress", 250);
  await page.getByText("WebSearch · Sources read").waitFor({ timeout: 360000 });
  // Reopen the persisted answer after the long browser/vision job. This also
  // verifies that Internet evidence survives a page refresh.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("WebSearch · Sources read").waitFor({ timeout: 30000 });
  await page
    .getByRole("region", { name: "Answer Card" })
    .locator(".source-reference .origin-badge.internet")
    .first()
    .waitFor();
  await capture("14-websearch-grounded", "Selected URL gives private Internet evidence");
  await pause(4500);
  await page
    .locator(".source-reference")
    .filter({ has: page.locator(".origin-badge.internet") })
    .first()
    .click();
  await page.getByRole("dialog", { name: "Source Panel" }).waitFor();
  await capture("15-websearch-source", "Internet evidence remains distinct from KB");
  await pause(2500);
  await page.keyboard.press("Escape");

  await openAsk();
  await page
    .getByRole("button", { name: "Enable WebSearch", exact: true })
    .click();
  await page.getByText("WebSearch options", { exact: true }).click();
  await page
    .getByLabel("Public Google query (optional)")
    .fill("site:example.com branch opening hours");
  await page
    .getByRole("textbox", { name: "Your question" })
    .fill("What is the latest public update on branch opening hours?");
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await page.getByText("WebSearch · Unavailable").waitFor({ timeout: 360000 });
  await page.getByText(/HTTP 429/).first().waitFor();
  await capture("16-google-blocked", "Google 429 is reported without invented results");
  await pause(4000);

  await openAsk();
  const unsupported = await ask(
    "How do I cultivate extraterrestrial spaghetti on Neptune?",
  );
  if (
    unsupported.sources.length ||
    unsupported.reliability.status !== "BLOCKED"
  ) {
    throw new Error("Unsupported question did not fail safely.");
  }
  await capture("17-insufficient-evidence", "No evidence means no conclusion");
  await pause(3500);

  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("employee");
  await page.goto(base + "/cases", { waitUntil: "domcontentloaded" });
  await page.getByRole("main").getByText("Annual Leave Review").first().waitFor();
  await capture("18-my-work", "Knowledge continues into persistent work");
  await pause(3000);
  await page
    .getByRole("region", { name: "My Work" })
    .getByRole("link", { name: "Annual Leave Review" })
    .first()
    .click();
  await page.getByRole("button", { name: "Begin review", exact: true }).click();
  await page
    .getByRole("button", { name: "Information checked", exact: true })
    .click();
  await page.getByRole("region", { name: "Review request" }).waitFor();
  await capture("18b-review-ready", "Employee evidence moves to independent review", 600);
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("compliance");
  await page.goto(base + "/regulatory", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("combobox", { name: "Regulation" })
    .waitFor();
  await page
    .getByText(/Start Regulatory Review|Continue open review/, { exact: true })
    .click();
  await page
    .getByRole("region", { name: "Regulation comparison" })
    .waitFor({ timeout: 30000 });
  await capture("19-regulatory-review", "Compliance review and remediation");
  await pause(3000);
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("finance");
  await page.goto(base + "/investment", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("combobox", { name: "Proposal" })
    .selectOption("proposal-a");
  await page
    .getByText(/Prepare Analysis|Continue open analysis/, { exact: true })
    .click();
  const assumptions = page.getByRole("region", { name: "Assumptions", exact: true });
  await assumptions.waitFor({ timeout: 30000 });
  if (await assumptions.getByText("Sources conflict").count()) {
    await capture("20-investment-assumptions", "Conflicting finance assumptions need a human choice");
    const investmentDecision = page.getByRole("form", {
      name: "Select value for Initial investment",
    });
    await investmentDecision
      .getByRole("radio", { name: /IDR 195,000,000/ })
      .check();
    await investmentDecision
      .getByRole("textbox", { name: "Reason for Initial investment" })
      .fill("The vendor quotation is the committed implementation price.");
    await investmentDecision
      .getByRole("button", { name: "Use selected value" })
      .click();
  } else {
    await capture("20-investment-assumptions", "Human source choice persists in the analysis");
  }
  await page
    .getByLabel("Deterministic results")
    .getByText("IDR 11,041,254")
    .waitFor({ timeout: 30000 });
  await page.getByLabel("Deterministic results").scrollIntoViewIfNeeded();
  await capture("21-investment-analysis", "Source-backed deterministic calculations");
  await pause(3000);
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("manager");
  await page.goto(base + "/decisions", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("region", { name: "Review queue" })
    .getByText("Annual Leave Review")
    .waitFor({ timeout: 30000 });
  await capture("22-human-reviews", "Evidence before human decisions");
  await pause(3000);

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("combobox", { name: "Viewing as" }).selectOption("governance");
  await page.goto(base + "/knowledge", { waitUntil: "domcontentloaded" });
  for (const [domain, name, title] of [
    ["Finance", "23-public-finance", "FDIC"],
    ["Operations", "24-public-operations", "NIST"],
    ["People", "25-public-people", "ILO"],
  ]) {
    await page
      .getByRole("combobox", { name: "Knowledge domain" })
      .selectOption(domain);
    await page.getByRole("button", { name: new RegExp(title) }).first().waitFor();
    await capture(name, "Public knowledge inventory for " + domain);
    await pause(1800);
  }
  await page.goto(base + "/impact", { waitUntil: "domcontentloaded" });
  await page.getByRole("main").getByText("Illustrative simulation").first().waitFor();
  await capture("26-impact", "Grounded action becomes measurable activity");
  await pause(6000);
  if (evidence.pageErrors.length || evidence.httpErrors.length) {
    throw new Error("Browser page error or HTTP 5xx occurred during recording.");
  }
  complete = true;
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  const video = page.video();
  await context.close();
  if (video && complete) {
    await copyFile(await video.path(), root + "/superflow-demo.webm");
  }
  await browser.close();
  await writeFile(
    "artifacts/verification/demo-run.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      complete,
      video: complete ? root + "/superflow-demo.webm" : null,
      scenes: evidence.scenes.length,
      answers: evidence.answers.length,
      captures: evidence.captures,
      pageErrors: evidence.pageErrors,
      consoleErrors: evidence.consoleErrors,
      httpErrors: evidence.httpErrors,
      http4xx: evidence.http4xx,
      failure: evidence.failure,
    }),
  );
}
