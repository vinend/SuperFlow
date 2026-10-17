import { api, type Answer, type User } from "./api";
import { isGuardResult } from "./reliability-view";

export async function waitForWebSearch(
  id: string,
  user: User,
  signal: AbortSignal,
): Promise<Answer> {
  let connectionFailures = 0;
  for (let attempt = 0; attempt < 1600; attempt++) {
    signal.throwIfAborted();
    let job: {
      status: string;
      message?: string;
      answer?: Answer;
    };
    try {
      job = await api(`/api/web-search/asks/${encodeURIComponent(id)}`, user, {
        signal,
      });
      connectionFailures = 0;
    } catch (error) {
      if (
        signal.aborted ||
        !(error instanceof Error) ||
        !error.message.startsWith("Cannot reach the knowledge API") ||
        ++connectionFailures > 5
      )
        throw error;
      job = { status: "reconnecting" };
    }
    if (job.status === "complete" && job.answer) {
      if (
        !isGuardResult(job.answer.reliability) ||
        !Array.isArray(job.answer.sources) ||
        (job.answer.reliability.status === "ACCESS_RESTRICTED" &&
          job.answer.sources.length > 0)
      )
        throw new Error(
          "Invalid reliability result from WebSearch. Check the API version.",
        );
      return job.answer;
    }
    if (job.status === "failed")
      throw new Error(job.message || "Local WebSearch failed. Try again.");
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 1500);
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  throw new Error(
    "WebSearch is still processing. Reload this page to resume watching it.",
  );
}
