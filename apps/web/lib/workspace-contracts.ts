import type { ReactNode } from "react";
import type { Answer, Source } from "./api";
import type { GuardResult } from "./reliability-contracts";
import type {
  ApprovalView,
  CaseView,
  WorkflowView,
} from "./workflow-contracts";
import type { DecisionAction } from "./workflow-view";

export type WorkflowTimelineProps = { workflow: WorkflowView };
export type ApprovalPanelProps = {
  approval: ApprovalView;
  context: CaseView;
  busy: boolean;
  onDecision: (
    action: DecisionAction,
    reason: string,
    evidenceLabel: string,
  ) => Promise<void>;
  onSource: (source: Source) => void;
  onDocument: (id: string, versionId?: string) => void;
};

export type EvidenceChecklistProps = {
  result: GuardResult;
  sources: Source[];
  onSource: (source: Source) => void;
  onDocument: (id: string, versionId?: string) => void;
};

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
  reliability?: GuardResult;
};

// Reserved names only. Future data contracts need approved backend schemas first.
export const WORKSPACE_COMPONENTS = {
  AnswerCard: "available",
  SourcePanel: "available",
  ComparisonTable: "deferred",
  EvidenceChecklist: "available",
  FinancialAnalysis: "deferred",
  ApprovalPanel: "available",
  WorkflowTimeline: "available",
} as const;

export type WorkspaceComponent =
  | { type: "AnswerCard"; data: Answer }
  | { type: "SourcePanel"; data: Source }
  | { type: "EvidenceChecklist"; data: GuardResult }
  | { type: "ApprovalPanel"; data: ApprovalView }
  | { type: "WorkflowTimeline"; data: WorkflowView }
  | {
      type: Exclude<
        keyof typeof WORKSPACE_COMPONENTS,
        | "AnswerCard"
        | "SourcePanel"
        | "EvidenceChecklist"
        | "ApprovalPanel"
        | "WorkflowTimeline"
      >;
      availability: "deferred";
      data?: never;
    };
