import { Bot, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPLICABILITY_STATUS,
  RISK_LEVEL,
  WORKFLOW_STATUS,
  type ApplicabilityStatus,
  type RiskLevel,
  type StatusStyle,
  type WorkflowStatus,
} from "./status";

function StatusPill({
  style,
  className,
}: {
  style: StatusStyle;
  className?: string;
}) {
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.textClass,
        style.bgClass,
        style.borderClass,
        className,
      )}
      title={style.description}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{style.label}</span>
      <span className="sr-only">{style.description}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  return <StatusPill style={WORKFLOW_STATUS[status]} />;
}

export function ApplicabilityBadge({ status }: { status: ApplicabilityStatus }) {
  return <StatusPill style={APPLICABILITY_STATUS[status]} />;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <StatusPill style={RISK_LEVEL[level]} />;
}

export function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-ds-border bg-ds-subtle px-2 py-0.5 text-[11px] font-medium text-ds-text-secondary">
      {label}
    </span>
  );
}

export function JurisdictionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-ds-primary-border bg-ds-primary-soft px-2 py-0.5 text-[11px] font-semibold text-ds-info">
      {label}
    </span>
  );
}

export function AiGeneratedLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ds-ai-border bg-ds-ai px-2 py-0.5 text-[11px] font-semibold text-ds-ai-heading">
      <Bot className="h-3 w-3" aria-hidden />
      AI-assisted
    </span>
  );
}

export function HumanReviewedLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ds-success-border bg-ds-success-bg px-2 py-0.5 text-[11px] font-semibold text-ds-success">
      <UserCheck className="h-3 w-3" aria-hidden />
      Human reviewed
    </span>
  );
}

export function OwnerAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-ds-navy font-semibold text-white",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
      )}
      title={name}
      aria-label={`Owner ${name}`}
    >
      {initials || "?"}
    </span>
  );
}

export function DueDateIndicator({
  date,
  overdue,
}: {
  date: string;
  overdue?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-xs font-medium",
        overdue ? "text-ds-critical" : "text-ds-text-secondary",
      )}
    >
      {overdue ? `Overdue · ${date}` : `Due ${date}`}
    </span>
  );
}

export function VersionIndicator({ version }: { version: string }) {
  return (
    <span className="rounded-full border border-ds-border bg-ds-subtle px-2 py-0.5 font-mono text-[11px] text-ds-text-secondary">
      v{version}
    </span>
  );
}

export function EffectiveDateLabel({ date }: { date: string }) {
  return (
    <span className="text-xs text-ds-text-secondary">
      Effective <time dateTime={date}>{date}</time>
    </span>
  );
}
