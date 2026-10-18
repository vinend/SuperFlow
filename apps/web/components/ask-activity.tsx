"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Circle, Sparkles, Timer } from "lucide-react";
import { ASK_STAGES, type AskProgress } from "@/lib/ask-progress";

export function AskActivity({
  progress,
  webSearch = false,
  scope = "Your accessible sources",
  startedAt,
}: {
  progress?: AskProgress | null;
  webSearch?: boolean;
  scope?: string;
  startedAt?: string;
}) {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = startedAt ? Date.parse(startedAt) : Date.now();
    const timer = setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [startedAt]);
  const stages =
    progress?.stage === "routing"
      ? [
          {
            id: "routing",
            title: "Open the right workspace",
            detail:
              "Match your request to an approved workspace available to your role.",
          },
        ]
      : progress?.stage === "saved"
        ? [
            {
              id: "saved",
              title: "Restore your saved answer",
              detail:
                "Recheck current access and reliability before showing saved evidence.",
            },
          ]
        : ASK_STAGES.filter((stage) => webSearch || stage.id !== "web_search");
  const current = stages.findIndex((stage) => stage.id === progress?.stage);
  return (
    <motion.section
      className="ask-activity"
      aria-label="Answer activity"
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
    >
      <div className="activity-hero">
        <div className="activity-spark" aria-hidden="true">
          <Sparkles size={25} />
        </div>
        <div>
          <span className="context-label">SuperFlow is working</span>
          <h3>
            {progress?.stage === "routing"
              ? "Finding your next workspace."
              : progress?.stage === "saved"
                ? "Opening your saved evidence."
                : "Building an answer you can inspect."}
          </h3>
        </div>
        <span className="activity-clock">
          <Timer size={14} />{" "}
          {elapsed >= 60
            ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
            : `${elapsed}s`}
        </span>
      </div>
      <p className="activity-message" role="status" aria-live="polite">
        {progress?.message ||
          "Sending your request. Waiting for the server to report its next step."}
      </p>
      <div className="activity-scope">
        <span>Search scope</span>
        <strong>{scope}</strong>
      </div>
      <ol className="activity-steps">
        {stages.map((stage, index) => {
          const active = current === index;
          // Only stages preceding a server-reported stage are complete.
          const done = current > index;
          return (
            <motion.li
              key={stage.id}
              className={active ? "active" : done ? "done" : "waiting"}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduced ? 0 : index * 0.09 }}
              aria-current={active ? "step" : undefined}
            >
              <span className="activity-step-icon" aria-hidden="true">
                {done ? (
                  <Check size={16} />
                ) : active ? (
                  <span className="activity-dot" />
                ) : (
                  <Circle size={13} />
                )}
              </span>
              <div>
                <strong>{stage.title}</strong>
                <p>{stage.detail}</p>
              </div>
              <span className="activity-step-state">
                {done ? "Done" : active ? "In progress" : "Next"}
              </span>
            </motion.li>
          );
        })}
      </ol>
      <div className="activity-footer">
        <span className="activity-pulse" aria-hidden="true" />
        {elapsed >= 30
          ? "Still working. Local AI and vision can take several minutes; elapsed time is not a completion estimate."
          : "Live server stages · no estimated percentages. Evidence and reliability will appear with your answer."}
      </div>
    </motion.section>
  );
}
