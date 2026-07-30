import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({
  className,
  width = "content",
  ...props
}: HTMLAttributes<HTMLDivElement> & { width?: "content" | "full" | "reading" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        width === "content" && "max-w-content",
        width === "reading" && "max-w-reading",
        width === "full" && "max-w-none",
        className,
      )}
      {...props}
    />
  );
}

export function Stack({
  className,
  gap = 4,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8 }) {
  return <div className={cn("flex flex-col", `gap-${gap}`, className)} {...props} />;
}

export function Inline({
  className,
  gap = 2,
  wrap = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gap?: 1 | 2 | 3 | 4; wrap?: boolean }) {
  return (
    <div
      className={cn("flex items-center", wrap && "flex-wrap", `gap-${gap}`, className)}
      {...props}
    />
  );
}

export function Grid({
  className,
  cols = 2,
  ...props
}: HTMLAttributes<HTMLDivElement> & { cols?: 1 | 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 md:grid-cols-2",
        cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}

export function Surface({
  className,
  tone = "surface",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "surface" | "subtle" | "page" }) {
  return (
    <div
      className={cn(
        "rounded-ds-lg border border-ds-border",
        tone === "surface" && "bg-ds-surface",
        tone === "subtle" && "bg-ds-subtle",
        tone === "page" && "bg-ds-page",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-ds-lg border border-ds-border bg-ds-surface p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn("border-0 border-t border-ds-border", className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  status,
}: {
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <header className="mb-6 space-y-3">
      {breadcrumbs}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-ds-page-title font-bold tracking-tight text-ds-text-primary text-[length:var(--ds-text-page-title)]">
              {title}
            </h1>
            {status}
          </div>
          {description ? (
            <p className="max-w-reading text-sm text-ds-text-secondary">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-ds-text-primary">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ds-text-secondary">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string; onClick?: () => void }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-ds-text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {isLast || (!item.onClick && !item.href) ? (
                <span className="font-medium text-ds-text-secondary" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="ds-focus-ring rounded-sm text-ds-text-muted hover:text-ds-primary"
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
