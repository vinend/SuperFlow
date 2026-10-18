import { writeFile } from "node:fs/promises";

const api = "http://127.0.0.1:8000";
const headers = { "Content-Type": "application/json", "X-User-Id": "sme" };
const submitted = await fetch(`${api}/api/web-search/asks`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    question: "What does Example Domain say about its use in documentation?",
    web_search: true,
    web_urls: ["https://example.com/"],
  }),
});
if (submitted.status !== 202) {
  throw new Error(`Start WebSearch: ${submitted.status} ${await submitted.text()}`);
}
const job = await submitted.json();
let result;
for (let attempt = 0; attempt < 120; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const response = await fetch(`${api}/api/web-search/asks/${job.id}`, {
    headers: { "X-User-Id": "sme" },
  });
  if (!response.ok) throw new Error(`Poll WebSearch: ${response.status}`);
  result = await response.json();
  if (result.status === "complete" || result.status === "failed") break;
}
if (result?.status !== "complete") {
  throw new Error(`WebSearch did not complete: ${JSON.stringify(result)}`);
}
const answer = result.answer;
const internet = answer.sources.filter((source) => source.source_origin === "internet");
if (
  answer.provider !== "ollama-grounded-v1" ||
  answer.web_search?.discovery !== "user-selected-urls" ||
  answer.web_search?.sources_read !== 1 ||
  internet.length === 0
) {
  throw new Error("WebSearch did not produce cited user-selected Internet evidence");
}
const evidence = {
  checked_at: new Date().toISOString(),
  run_id: answer.id,
  provider: answer.provider,
  reliability: answer.reliability.status,
  web_search: answer.web_search,
  internet_sources: internet.map((source) => ({
    title: source.title,
    url: source.source_url,
    extraction_method: source.extraction_method,
  })),
  answer: answer.answer,
};
const googleSubmitted = await fetch(`${api}/api/web-search/asks`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    question: "What is the latest public update on branch opening hours?",
    web_search: true,
    web_query: "site:example.com branch opening hours",
  }),
});
if (googleSubmitted.status !== 202) {
  throw new Error(`Start Google discovery: ${googleSubmitted.status}`);
}
const googleJob = await googleSubmitted.json();
let googleResult;
for (let attempt = 0; attempt < 120; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const response = await fetch(`${api}/api/web-search/asks/${googleJob.id}`, {
    headers: { "X-User-Id": "sme" },
  });
  if (!response.ok) throw new Error(`Poll Google discovery: ${response.status}`);
  googleResult = await response.json();
  if (googleResult.status === "complete" || googleResult.status === "failed") break;
}
if (googleResult?.status !== "complete") {
  throw new Error(`Google discovery did not finish: ${JSON.stringify(googleResult)}`);
}
evidence.google_discovery = {
  run_id: googleResult.answer.id,
  status: googleResult.answer.web_search?.status,
  http_status: googleResult.answer.web_search?.http_status ?? null,
  sources_read: googleResult.answer.web_search?.sources_read ?? null,
  internet_sources: googleResult.answer.sources.filter(
    (source) => source.source_origin === "internet",
  ).length,
};
await writeFile(
  "artifacts/verification/websearch-live.json",
  JSON.stringify(evidence, null, 2),
);
console.log(
  JSON.stringify({
    run_id: evidence.run_id,
    status: evidence.web_search.status,
    sources_read: evidence.web_search.sources_read,
    internet_sources: internet.length,
    google: evidence.google_discovery,
  }),
);
