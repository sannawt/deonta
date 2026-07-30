import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./actions";

export function KeyValueList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="divide-y divide-ds-border rounded-ds-md border border-ds-border">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[10rem_1fr]">
          <dt className="text-xs font-semibold text-ds-text-muted">{item.label}</dt>
          <dd className="text-sm text-ds-text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-ds-lg border border-ds-border bg-ds-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ds-text-primary">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ds-text-secondary">{hint}</p> : null}
    </div>
  );
}

export function LegalCitationBlock({
  citation,
  title,
  excerpt,
}: {
  citation: string;
  title?: string;
  excerpt?: string;
}) {
  return (
    <figure className="rounded-ds-md border border-ds-border bg-ds-subtle p-3">
      <figcaption className="ds-citation font-medium text-ds-info">{citation}</figcaption>
      {title ? <p className="mt-1 text-sm font-semibold text-ds-text-primary">{title}</p> : null}
      {excerpt ? (
        <blockquote className="ds-legal-prose mt-2 text-sm text-ds-text-secondary">
          {excerpt}
        </blockquote>
      ) : null}
    </figure>
  );
}

export function SourceReferenceCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="rounded-ds-md border border-ds-border bg-ds-surface p-3">
      <h4 className="text-sm font-semibold text-ds-text-primary">{title}</h4>
      {meta ? <p className="mt-0.5 text-xs text-ds-text-muted">{meta}</p> : null}
      {children ? <div className="mt-2 text-sm text-ds-text-secondary">{children}</div> : null}
    </article>
  );
}

export function Timeline({
  events,
}: {
  events: Array<{ id: string; title: string; meta: string; detail?: string }>;
}) {
  return (
    <ol className="space-y-3 border-l border-ds-border pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ds-primary bg-ds-surface" />
          <p className="text-sm font-semibold text-ds-text-primary">{event.title}</p>
          <p className="text-xs text-ds-text-muted">{event.meta}</p>
          {event.detail ? (
            <p className="mt-1 text-sm text-ds-text-secondary">{event.detail}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
  sortId,
  sortDir,
  onSort,
  bulkActions,
}: {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  selectedIds?: string[];
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
  sortId?: string;
  sortDir?: "asc" | "desc";
  onSort?: (id: string) => void;
  bulkActions?: React.ReactNode;
}) {
  const allSelected = Boolean(rows.length && selectedIds && selectedIds.length === rows.length);
  return (
    <div className="overflow-hidden rounded-ds-lg border border-ds-border bg-ds-surface">
      {bulkActions && selectedIds && selectedIds.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-ds-border bg-ds-primary-soft px-3 py-2">
          <p className="text-xs font-semibold text-ds-info">{selectedIds.length} selected</p>
          <div className="flex gap-2">{bulkActions}</div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-ds-subtle">
            <tr>
              {onToggleRow ? (
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="ds-focus-ring h-4 w-4 rounded border-ds-border-strong"
                    checked={allSelected}
                    onChange={() => onToggleAll?.()}
                    aria-label="Select all rows"
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-ds-text-muted"
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      className="ds-focus-ring inline-flex items-center gap-1 rounded-sm"
                      onClick={() => onSort(col.id)}
                    >
                      {col.header}
                      {sortId === col.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = selectedIds?.includes(row.id);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-ds-border",
                    selected ? "bg-ds-primary-soft/60" : "bg-ds-surface",
                  )}
                >
                  {onToggleRow ? (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="ds-focus-ring h-4 w-4 rounded border-ds-border-strong"
                        checked={Boolean(selected)}
                        onChange={() => onToggleRow(row.id)}
                        aria-label={`Select row ${row.id}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td key={col.id} className="px-3 py-2 align-top text-ds-text-primary">
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-ds-border px-4 py-8 text-center text-sm text-ds-text-secondary">
          No rows match the current filters.
        </div>
      ) : null}
    </div>
  );
}

export function TableToolbar({
  search,
  onSearch,
  filters,
  actions,
}: {
  search: string;
  onSearch: (value: string) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search obligations…"
          className="ds-focus-ring w-full max-w-sm rounded-ds-sm border border-ds-border px-3 py-2 text-sm"
          aria-label="Search"
        />
        {filters}
      </div>
      {actions}
    </div>
  );
}

export function BulkActionBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

export function QuietButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="ghost" size="sm" {...props} />;
}
