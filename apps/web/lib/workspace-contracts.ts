import type { ReactNode } from "react";
import type { Answer, Source } from "./api";

export type AnswerCardProps = {
  answer: Answer;
  onSource: (source: Source) => void;
  onDocument: (id: string, versionId?: string) => void;
  reliabilitySlot?: ReactNode;
};
export type SourcePanelProps = {
  source: Source;
  close: () => void;
  openDocument: (id: string, versionId?: string) => void;
};

// Reserved names only. Future data contracts need approved backend schemas first.
export const WORKSPACE_COMPONENTS = {
  AnswerCard: "available",
  SourcePanel: "available",
  ComparisonTable: "deferred",
  EvidenceChecklist: "deferred",
  FinancialAnalysis: "deferred",
  ApprovalPanel: "deferred",
  WorkflowTimeline: "deferred",
} as const;

export type WorkspaceComponent =
  | { type: "AnswerCard"; data: Answer }
  | { type: "SourcePanel"; data: Source }
  | {
      type: Exclude<
        keyof typeof WORKSPACE_COMPONENTS,
        "AnswerCard" | "SourcePanel"
      >;
      availability: "deferred";
      data?: never;
    };
