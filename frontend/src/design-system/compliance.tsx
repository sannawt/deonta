import type { ReactNode } from "react";
import { Button } from "./actions";
import {
  AiGeneratedLabel,
  ApplicabilityBadge,
  DueDateIndicator,
  HumanReviewedLabel,
  JurisdictionBadge,
  OwnerAvatar,
  RiskBadge,
  SourceBadge,
  StatusBadge,
} from "./badges";
import { LegalCitationBlock, SourceReferenceCard } from "./data";
import type { ApplicabilityStatus, RiskLevel, WorkflowStatus } from "./status";

export function ApplicabilityResultCard({
  lawName,
  jurisdiction,
  status,
  explanation,
  missingInfo,
  effectiveDate,
  reviewStatus,
  primaryAction,
}: {
  lawName: string;
  jurisdiction: string;
  status: ApplicabilityStatus;
  explanation: string;
  missingInfo?: string[];
  effectiveDate?: string;
  reviewStatus?: WorkflowStatus;
  primaryAction?: ReactNode;
}) {
  return (
    <article className="rounded-ds-lg border border-ds-border bg-ds-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ds-text-primary">{lawName}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <JurisdictionBadge label={jurisdiction} />
            <ApplicabilityBadge status={status} />
            {reviewStatus ? <StatusBadge status={reviewStatus} /> : null}
          </div>
        </div>
        {primaryAction}
      </div>
      <p className="mt-3 text-sm text-ds-text-secondary">{explanation}</p>
      {missingInfo && missingInfo.length > 0 ? (
        <div className="mt-3 rounded-ds-md border border-ds-warning-border bg-ds-warning-bg p-2.5">
          <p className="text-xs font-semibold text-ds-warning">Missing company information</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ds-text-primary">
            {missingInfo.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {effectiveDate ? (
        <p className="mt-3 text-xs text-ds-text-muted">Effective date: {effectiveDate}</p>
      ) : null}
    </article>
  );
}

export function ApplicabilityReasoningPanel({
  assessment,
  facts,
  assumptions,
  missing,
  exceptions,
  sources,
  actions,
}: {
  assessment: string;
  facts: string[];
  assumptions?: string[];
  missing?: string[];
  exceptions?: string[];
  sources?: Array<{ citation: string; title: string; excerpt?: string }>;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-ds-lg border border-ds-ai-border bg-ds-ai p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ds-ai-heading">AI assessment</h3>
        <AiGeneratedLabel />
      </div>
      <p className="text-sm text-ds-ai-text">{assessment}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-ds-ai-heading">
            Company facts used
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ds-text-primary">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-ds-ai-heading">
            Assumptions
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ds-text-primary">
            {(assumptions ?? ["No additional assumptions recorded."]).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
      {missing && missing.length > 0 ? (
        <div className="mt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ds-ai-heading">
            Missing information
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ds-text-primary">
            {missing.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {exceptions && exceptions.length > 0 ? (
        <div className="mt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ds-ai-heading">
            Exceptions and limitations
          </h4>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ds-text-primary">
            {exceptions.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {sources && sources.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ds-ai-heading">
            Supporting legal sources
          </h4>
          {sources.map((s) => (
            <LegalCitationBlock
              key={s.citation}
              citation={s.citation}
              title={s.title}
              excerpt={s.excerpt}
            />
          ))}
        </div>
      ) : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}

export function ObligationCard({
  title,
  description,
  source,
  owner,
  dueDate,
  overdue,
  controlCoverage,
  evidenceStatus,
  reviewStatus,
  nextAction,
}: {
  title: string;
  description: string;
  source: string;
  owner: string;
  dueDate: string;
  overdue?: boolean;
  controlCoverage: string;
  evidenceStatus: WorkflowStatus;
  reviewStatus: WorkflowStatus;
  nextAction?: ReactNode;
}) {
  return (
    <article className="rounded-ds-lg border border-ds-border bg-ds-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ds-text-primary">{title}</h3>
          <p className="mt-1 text-sm text-ds-text-secondary">{description}</p>
        </div>
        {nextAction}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SourceBadge label={source} />
        <StatusBadge status={reviewStatus} />
        <StatusBadge status={evidenceStatus} />
        <DueDateIndicator date={dueDate} overdue={overdue} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ds-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <OwnerAvatar name={owner} size="sm" />
          {owner}
        </span>
        <span>Control coverage: {controlCoverage}</span>
      </div>
    </article>
  );
}

export function RegulatoryChangeItem({
  regulation,
  summary,
  published,
  effective,
  impact,
  reviewer,
  affectedObligations,
  action,
}: {
  regulation: string;
  summary: string;
  published: string;
  effective: string;
  impact: RiskLevel;
  reviewer: string;
  affectedObligations: number;
  action?: ReactNode;
}) {
  return (
    <article className="rounded-ds-lg border border-ds-border bg-ds-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ds-text-primary">{regulation}</h3>
          <p className="mt-1 text-sm text-ds-text-secondary">{summary}</p>
        </div>
        <RiskBadge level={impact} />
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-ds-text-secondary sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ds-text-muted">Published</dt>
          <dd>{published}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ds-text-muted">Effective</dt>
          <dd>{effective}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ds-text-muted">Reviewer</dt>
          <dd className="inline-flex items-center gap-1.5">
            <OwnerAvatar name={reviewer} size="sm" />
            {reviewer}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ds-text-muted">Potentially affected obligations</dt>
          <dd>{affectedObligations}</dd>
        </div>
      </dl>
      {action ? <div className="mt-3">{action}</div> : null}
    </article>
  );
}

export function EvidenceItem({
  name,
  type,
  control,
  owner,
  uploaded,
  reviewDate,
  status,
}: {
  name: string;
  type: string;
  control: string;
  owner: string;
  uploaded: string;
  reviewDate: string;
  status: WorkflowStatus;
}) {
  return (
    <article className="rounded-ds-md border border-ds-border bg-ds-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ds-text-primary">{name}</h4>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1 text-xs text-ds-text-secondary">
        {type} · Linked control: {control}
      </p>
      <p className="mt-2 text-xs text-ds-text-muted">
        Owner {owner} · Uploaded {uploaded} · Review by {reviewDate}
      </p>
    </article>
  );
}

export function AuditLogEntry({
  action,
  user,
  timestamp,
  previousValue,
  nextValue,
  reason,
  source,
}: {
  action: string;
  user: string;
  timestamp: string;
  previousValue?: string;
  nextValue?: string;
  reason?: string;
  source?: string;
}) {
  return (
    <article className="rounded-ds-md border border-ds-border bg-ds-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ds-text-primary">{action}</h4>
        <time className="text-xs text-ds-text-muted" dateTime={timestamp}>
          {timestamp}
        </time>
      </div>
      <p className="mt-1 text-xs text-ds-text-secondary">
        {user}
        {source ? ` · ${source}` : ""}
      </p>
      {(previousValue || nextValue) && (
        <p className="mt-2 text-xs text-ds-text-secondary">
          {previousValue ? <span>From: {previousValue}</span> : null}
          {previousValue && nextValue ? " → " : null}
          {nextValue ? <span>To: {nextValue}</span> : null}
        </p>
      )}
      {reason ? <p className="mt-1 text-xs text-ds-text-muted">Reason: {reason}</p> : null}
    </article>
  );
}

export function AiAssessmentPanel({
  recommendation,
  explanation,
  sources,
  assumptions,
  missingFacts,
  confidenceWording = "Requires confirmation",
  reviewStatus,
  onAccept,
  onEdit,
  onReject,
  onRequestReview,
}: {
  recommendation: string;
  explanation: string;
  sources: string[];
  assumptions: string[];
  missingFacts: string[];
  confidenceWording?: string;
  reviewStatus: WorkflowStatus;
  onAccept?: () => void;
  onEdit?: () => void;
  onReject?: () => void;
  onRequestReview?: () => void;
}) {
  return (
    <section className="rounded-ds-lg border border-ds-ai-border bg-ds-ai p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ds-ai-heading">AI recommendation</h3>
        <AiGeneratedLabel />
        <StatusBadge status={reviewStatus} />
        <HumanReviewedLabel />
      </div>
      <p className="mt-2 text-sm font-semibold text-ds-ai-text">{recommendation}</p>
      <p className="mt-1 text-sm text-ds-text-primary">{explanation}</p>
      <p className="mt-2 text-xs font-medium text-ds-ai-heading">{confidenceWording}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <SourceReferenceCard title="Sources" meta={`${sources.length} linked`}>
          <ul className="list-disc space-y-1 pl-4">
            {sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </SourceReferenceCard>
        <SourceReferenceCard title="Assumptions">
          <ul className="list-disc space-y-1 pl-4">
            {assumptions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </SourceReferenceCard>
        <SourceReferenceCard title="Missing facts">
          <ul className="list-disc space-y-1 pl-4">
            {missingFacts.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </SourceReferenceCard>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onAccept}>
          Accept
        </Button>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onReject}>
          Reject
        </Button>
        <Button variant="tertiary" size="sm" onClick={onRequestReview}>
          Request legal review
        </Button>
      </div>
    </section>
  );
}
