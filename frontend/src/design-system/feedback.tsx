import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./actions";

type Tone = "info" | "success" | "warning" | "critical" | "neutral";

const toneMap: Record<
  Tone,
  { icon: typeof Info; wrap: string; title: string }
> = {
  info: {
    icon: Info,
    wrap: "border-ds-info-border bg-ds-info-bg text-ds-info",
    title: "text-ds-info",
  },
  success: {
    icon: CheckCircle2,
    wrap: "border-ds-success-border bg-ds-success-bg text-ds-success",
    title: "text-ds-success",
  },
  warning: {
    icon: AlertTriangle,
    wrap: "border-ds-warning-border bg-ds-warning-bg text-ds-warning",
    title: "text-ds-warning",
  },
  critical: {
    icon: XCircle,
    wrap: "border-ds-critical-border bg-ds-critical-bg text-ds-critical",
    title: "text-ds-critical",
  },
  neutral: {
    icon: Info,
    wrap: "border-ds-unknown-border bg-ds-unknown-bg text-ds-unknown",
    title: "text-ds-unknown",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  onDismiss,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const cfg = toneMap[tone];
  const Icon = cfg.icon;
  return (
    <div
      role="status"
      className={cn("flex gap-3 rounded-ds-md border p-3 text-sm", cfg.wrap)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold", cfg.title)}>{title}</p>
        {children ? <div className="mt-1 text-ds-text-primary">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="ds-focus-ring rounded-sm p-1 hover:bg-black/5"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-ds-lg border border-dashed border-ds-border-strong bg-ds-subtle px-6 py-10 text-center">
      <h3 className="text-sm font-semibold text-ds-text-primary">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ds-text-secondary">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-ds-sm bg-ds-border/70", className)}
      aria-hidden
    />
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ds-text-secondary" role="status">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ds-border-strong border-t-ds-primary" />
      {label}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-ds-navy/40"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ds-confirm-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-ds-xl border border-ds-border bg-ds-surface p-5 shadow-ds-lg"
      >
        <h2 id="ds-confirm-title" className="text-base font-semibold text-ds-text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm text-ds-text-secondary">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-drawer flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-ds-navy/30"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-ds-border bg-ds-surface shadow-ds-lg"
      >
        <header className="flex items-center justify-between border-b border-ds-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ds-text-primary">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: React.ReactElement;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-dropdown mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded-ds-sm border border-ds-border bg-ds-navy px-2 py-1 text-xs text-white shadow-ds-md group-hover:block group-focus-within:block"
      >
        {content}
      </span>
    </span>
  );
}

/** Compact inline notice — use for field-adjacent or section-level feedback. */
export function InlineNotice({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  const cfg = toneMap[tone];
  return (
    <p
      className={cn(
        "rounded-ds-sm border px-2.5 py-1.5 text-xs font-medium",
        cfg.wrap,
      )}
      role="status"
    >
      {children}
    </p>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <EmptyState
      title={title}
      description={description ?? "Try again, or contact your workspace admin if the problem continues."}
      action={action}
    />
  );
}

export function Toast({
  open,
  tone = "info",
  title,
  children,
  onClose,
}: {
  open: boolean;
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-toast w-[min(24rem,calc(100vw-2rem))]"
      role="status"
      aria-live="polite"
    >
      <Alert tone={tone} title={title} onDismiss={onClose}>
        {children}
      </Alert>
    </div>
  );
}

export function Popover({
  open,
  onClose,
  anchorLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorLabel: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="relative inline-block">
      <div
        role="dialog"
        aria-label={anchorLabel}
        className="absolute left-0 top-full z-dropdown mt-1 min-w-[14rem] rounded-ds-md border border-ds-border bg-ds-surface p-3 shadow-ds-md"
      >
        {children}
        <button
          type="button"
          className="sr-only"
          onClick={onClose}
          onBlur={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
