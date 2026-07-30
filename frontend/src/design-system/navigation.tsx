import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Sections" className="flex gap-1 border-b border-ds-border">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "ds-focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              selected
                ? "border-ds-primary text-ds-primary"
                : "border-transparent text-ds-text-muted hover:text-ds-text-primary",
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-ds-sm border border-ds-border bg-ds-subtle p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={cn(
            "ds-focus-ring rounded-[5px] px-3 py-1.5 text-xs font-semibold",
            value === opt.id
              ? "bg-ds-surface text-ds-text-primary shadow-ds-sm"
              : "text-ds-text-muted hover:text-ds-text-primary",
          )}
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: string[];
  currentIndex: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Workflow progress">
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-xs font-bold",
                state === "current" && "border-ds-primary bg-ds-primary text-white",
                state === "done" && "border-ds-info-border bg-ds-info-bg text-ds-info",
                state === "upcoming" && "border-ds-border bg-ds-surface text-ds-text-muted",
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                state === "current" ? "text-ds-text-primary" : "text-ds-text-muted",
              )}
            >
              {step}
            </span>
            {index < steps.length - 1 ? (
              <span className="text-ds-border-strong" aria-hidden>
                —
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="flex items-center gap-2" aria-label="Pagination">
      <button
        type="button"
        className="ds-focus-ring rounded-ds-sm border border-ds-border px-2 py-1 text-xs font-semibold disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-xs text-ds-text-secondary">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className="ds-focus-ring rounded-ds-sm border border-ds-border px-2 py-1 text-xs font-semibold disabled:opacity-40"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

/** Linear progress across named workflow stages (not a percentage bar). */
export function ProgressNavigation({
  steps,
  currentIndex,
  onSelect,
}: {
  steps: string[];
  currentIndex: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <nav aria-label="Workflow progress" className="space-y-2">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={step}>
              <button
                type="button"
                disabled={!onSelect}
                onClick={() => onSelect?.(index)}
                className={cn(
                  "ds-focus-ring rounded-full border px-3 py-1 text-xs font-semibold",
                  current && "border-ds-primary bg-ds-primary-soft text-ds-info",
                  done && "border-ds-border bg-ds-subtle text-ds-text-secondary",
                  !done && !current && "border-ds-border text-ds-text-muted",
                )}
                aria-current={current ? "step" : undefined}
              >
                {index + 1}. {step}
              </button>
            </li>
          );
        })}
      </ol>
      <div
        className="h-1 overflow-hidden rounded-full bg-ds-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={currentIndex + 1}
        aria-label="Workflow stage"
      >
        <div
          className="h-full bg-ds-primary transition-all duration-normal"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
    </nav>
  );
}
