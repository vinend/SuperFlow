export type AskProgress = { stage: string; message: string };

export const ASK_STAGES = [
  {
    id: "retrieving",
    title: "Find the evidence",
    detail: "Search the knowledge base within your access and version filters.",
  },
  {
    id: "web_search",
    title: "Explore the web",
    detail:
      "Open public pages with local Puppeteer and inspect screenshots with vision.",
  },
  {
    id: "generating",
    title: "Compose your answer",
    detail:
      "Use the selected excerpts to compose an answer with source references.",
  },
  {
    id: "verifying",
    title: "Check reliability",
    detail:
      "Validate citations, permissions, conflicts and review requirements.",
  },
];
