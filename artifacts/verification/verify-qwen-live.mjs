import { writeFile } from "node:fs/promises";

const api = "http://127.0.0.1:8000";
const healthResponse = await fetch(`${api}/api/health`);
if (!healthResponse.ok) throw new Error(`API health: ${healthResponse.status}`);
const health = await healthResponse.json();
if (health.inference_provider !== "ollama-grounded-v1") {
  throw new Error(`Expected Ollama, got ${health.inference_provider}`);
}

const scenarios = [
  {
    name: "employee-policy",
    actor: "employee",
    body: {
      question: "How many annual leave days do I get?",
    },
    expectedTitle: "Annual Leave Policy",
    expectedAnswer: /15 days/i,
  },
  {
    name: "official-ojk",
    actor: "compliance",
    body: {
      question:
        "Apa kewajiban autentikasi dua faktor untuk layanan digital bank menurut POJK 21 Tahun 2023?",
    },
    expectedTitle: "OJK POJK 21 Tahun 2023",
    expectedAnswer: /dua faktor|2 \(dua\) faktor/i,
  },
];

const results = [];
for (const scenario of scenarios) {
  const response = await fetch(`${api}/api/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": scenario.actor,
    },
    body: JSON.stringify(scenario.body),
  });
  if (response.status !== 201) {
    throw new Error(`${scenario.name}: HTTP ${response.status} ${await response.text()}`);
  }
  const answer = await response.json();
  const first = answer.sources[0];
  if (
    answer.provider !== "ollama-grounded-v1" ||
    answer.reliability.status !== "REVIEW_REQUIRED" ||
    !first?.title.includes(scenario.expectedTitle) ||
    !scenario.expectedAnswer.test(answer.answer)
  ) {
    throw new Error(`${scenario.name}: provider, source, answer or Guard mismatch`);
  }
  results.push({
    scenario: scenario.name,
    run_id: answer.id,
    provider: answer.provider,
    reliability: answer.reliability.status,
    source_count: answer.sources.length,
    first_source: first.title,
    first_section: first.section_path,
    answer: answer.answer,
  });
}

const evidence = {
  checked_at: new Date().toISOString(),
  model: health.inference_model,
  retrieval_provider: health.retrieval_provider,
  retrieval_engine: health.retrieval_engine,
  results,
};
await writeFile(
  "artifacts/verification/qwen-live.json",
  JSON.stringify(evidence, null, 2),
);
console.log(
  JSON.stringify({ model: evidence.model, scenarios: results.map((r) => r.scenario) }),
);
