import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FileWarning,
  HelpCircle,
  Hourglass,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

export type WorkflowStatus =
  | "draft"
  | "information_required"
  | "ready_for_review"
  | "under_review"
  | "confirmed"
  | "implementation_in_progress"
  | "evidence_required"
  | "ready_for_approval"
  | "approved"
  | "rejected"
  | "reassessment_required"
  | "archived";

/** Applicability is neutral — never use success green for “applies”. */
export type ApplicabilityStatus =
  | "likely_applies"
  | "information_required"
  | "likely_does_not_apply"
  | "confirmed_applicable"
  | "confirmed_not_applicable"
  | "outside_platform_coverage"
  | "reassessment_required";

export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export interface StatusStyle {
  label: string;
  description: string;
  icon: LucideIcon;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

export const WORKFLOW_STATUS: Record<WorkflowStatus, StatusStyle> = {
  draft: {
    label: "Draft",
    description: "Work in progress; not yet submitted for review.",
    icon: CircleDashed,
    textClass: "text-ds-unknown",
    bgClass: "bg-ds-unknown-bg",
    borderClass: "border-ds-unknown-border",
  },
  information_required: {
    label: "Information required",
    description: "Additional company facts are needed before a decision.",
    icon: HelpCircle,
    textClass: "text-ds-warning",
    bgClass: "bg-ds-warning-bg",
    borderClass: "border-ds-warning-border",
  },
  ready_for_review: {
    label: "Ready for review",
    description: "Prepared for human review.",
    icon: ClipboardList,
    textClass: "text-ds-info",
    bgClass: "bg-ds-info-bg",
    borderClass: "border-ds-info-border",
  },
  under_review: {
    label: "Under review",
    description: "A reviewer is actively assessing this item.",
    icon: Hourglass,
    textClass: "text-ds-info",
    bgClass: "bg-ds-info-bg",
    borderClass: "border-ds-info-border",
  },
  confirmed: {
    label: "Confirmed",
    description: "Decision confirmed by a human reviewer.",
    icon: CheckCircle2,
    textClass: "text-ds-success",
    bgClass: "bg-ds-success-bg",
    borderClass: "border-ds-success-border",
  },
  implementation_in_progress: {
    label: "Implementation in progress",
    description: "Controls or tasks are being implemented.",
    icon: RefreshCw,
    textClass: "text-ds-info",
    bgClass: "bg-ds-info-bg",
    borderClass: "border-ds-info-border",
  },
  evidence_required: {
    label: "Evidence required",
    description: "Supporting evidence must be attached or verified.",
    icon: FileWarning,
    textClass: "text-ds-warning",
    bgClass: "bg-ds-warning-bg",
    borderClass: "border-ds-warning-border",
  },
  ready_for_approval: {
    label: "Ready for approval",
    description: "Awaiting final approval.",
    icon: ShieldCheck,
    textClass: "text-ds-info",
    bgClass: "bg-ds-info-bg",
    borderClass: "border-ds-info-border",
  },
  approved: {
    label: "Approved",
    description: "Approved for the current assessment cycle.",
    icon: CheckCircle2,
    textClass: "text-ds-success",
    bgClass: "bg-ds-success-bg",
    borderClass: "border-ds-success-border",
  },
  rejected: {
    label: "Rejected",
    description: "Rejected; requires revision or reassessment.",
    icon: XCircle,
    textClass: "text-ds-critical",
    bgClass: "bg-ds-critical-bg",
    borderClass: "border-ds-critical-border",
  },
  reassessment_required: {
    label: "Reassessment required",
    description: "Facts or regulations changed; reassess applicability.",
    icon: RefreshCw,
    textClass: "text-ds-warning",
    bgClass: "bg-ds-warning-bg",
    borderClass: "border-ds-warning-border",
  },
  archived: {
    label: "Archived",
    description: "No longer active in the current workspace.",
    icon: Archive,
    textClass: "text-ds-unknown",
    bgClass: "bg-ds-unknown-bg",
    borderClass: "border-ds-unknown-border",
  },
};

export const APPLICABILITY_STATUS: Record<ApplicabilityStatus, StatusStyle> = {
  likely_applies: {
    label: "Likely applies",
    description: "Based on current facts, this framework is likely in scope. Confirmation recommended.",
    icon: Info,
    textClass: "text-ds-info",
    bgClass: "bg-ds-info-bg",
    borderClass: "border-ds-info-border",
  },
  information_required: {
    label: "Information required",
    description: "Missing company information prevents a reliable applicability conclusion.",
    icon: HelpCircle,
    textClass: "text-ds-warning",
    bgClass: "bg-ds-warning-bg",
    borderClass: "border-ds-warning-border",
  },
  likely_does_not_apply: {
    label: "Likely does not apply",
    description: "Based on current facts, this framework is likely out of scope.",
    icon: CircleDashed,
    textClass: "text-ds-unknown",
    bgClass: "bg-ds-unknown-bg",
    borderClass: "border-ds-unknown-border",
  },
  confirmed_applicable: {
    label: "Confirmed applicable",
    description: "A human reviewer confirmed this framework applies.",
    icon: ShieldCheck,
    textClass: "text-ds-info",
    bgClass: "bg-ds-info-bg",
    borderClass: "border-ds-info-border",
  },
  confirmed_not_applicable: {
    label: "Confirmed not applicable",
    description: "A human reviewer confirmed this framework does not apply.",
    icon: ShieldAlert,
    textClass: "text-ds-unknown",
    bgClass: "bg-ds-unknown-bg",
    borderClass: "border-ds-unknown-border",
  },
  outside_platform_coverage: {
    label: "Outside platform coverage",
    description: "This framework is outside the current deterministic scope engine.",
    icon: AlertCircle,
    textClass: "text-ds-unknown",
    bgClass: "bg-ds-unknown-bg",
    borderClass: "border-ds-unknown-border",
  },
  reassessment_required: {
    label: "Reassessment required",
    description: "A regulatory or factual change requires reassessing applicability.",
    icon: RefreshCw,
    textClass: "text-ds-warning",
    bgClass: "bg-ds-warning-bg",
    borderClass: "border-ds-warning-border",
  },
};

export const RISK_LEVEL: Record<RiskLevel, StatusStyle> = {
  low: {
    label: "Low",
    description: "Low relative risk for the current use case.",
    icon: CheckCircle2,
    textClass: "text-ds-success",
    bgClass: "bg-ds-success-bg",
    borderClass: "border-ds-success-border",
  },
  medium: {
    label: "Medium",
    description: "Moderate risk; monitor controls and evidence.",
    icon: AlertCircle,
    textClass: "text-ds-warning",
    bgClass: "bg-ds-warning-bg",
    borderClass: "border-ds-warning-border",
  },
  high: {
    label: "High",
    description: "Elevated risk; prioritise review and controls.",
    icon: ShieldAlert,
    textClass: "text-ds-critical",
    bgClass: "bg-ds-critical-bg",
    borderClass: "border-ds-critical-border",
  },
  critical: {
    label: "Critical",
    description: "Critical risk; immediate attention required.",
    icon: XCircle,
    textClass: "text-ds-critical",
    bgClass: "bg-ds-critical-bg",
    borderClass: "border-ds-critical-border",
  },
  unknown: {
    label: "Unknown",
    description: "Risk level has not been determined.",
    icon: HelpCircle,
    textClass: "text-ds-unknown",
    bgClass: "bg-ds-unknown-bg",
    borderClass: "border-ds-unknown-border",
  },
};
