import { useState, type ReactNode } from "react";
import {
  BookOpen,
  LayoutDashboard,
  PanelLeft,
  Scale,
  Table2,
  Bell,
  Shapes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./actions";

export type DsShowcaseView =
  | "foundations"
  | "components"
  | "dashboard"
  | "applicability"
  | "obligations"
  | "changes";

const NAV: Array<{ id: DsShowcaseView; label: string; icon: typeof Shapes }> = [
  { id: "foundations", label: "Foundations", icon: Shapes },
  { id: "components", label: "Components", icon: BookOpen },
  { id: "dashboard", label: "Compliance dashboard", icon: LayoutDashboard },
  { id: "applicability", label: "Applicability review", icon: Scale },
  { id: "obligations", label: "Obligations table", icon: Table2 },
  { id: "changes", label: "Regulatory change inbox", icon: Bell },
];

export function DesignSystemShell({
  view,
  onViewChange,
  onExit,
  children,
}: {
  view: DsShowcaseView;
  onViewChange: (view: DsShowcaseView) => void;
  onExit: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="ds-root flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col bg-ds-navy text-ds-text-inverse",
          collapsed ? "w-16" : "w-sidebar",
        )}
        aria-label="Design system navigation"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
          {!collapsed ? (
            <div>
              <p className="text-sm font-bold">ComplianceTwin</p>
              <p className="text-[11px] text-ds-text-inverse-muted">Design system</p>
            </div>
          ) : (
            <span className="mx-auto text-sm font-bold">CT</span>
          )}
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeft className="h-4 w-4" />
          </IconButton>
        </div>
        <nav className="flex-1 space-y-1 overflow-auto p-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === view;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "ds-focus-ring flex w-full items-center gap-2 rounded-ds-sm px-2.5 py-2 text-left text-sm",
                  active
                    ? "bg-ds-primary/40 font-semibold text-white"
                    : "text-ds-text-inverse-muted hover:bg-white/10 hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
                onClick={() => onViewChange(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {!collapsed ? <span>{item.label}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Button
            variant="secondary"
            size="sm"
            className="w-full border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={onExit}
          >
            {collapsed ? "←" : "Back to workspace"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex h-header items-center justify-between border-b border-ds-border bg-ds-surface px-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
              Internal UI preview
            </p>
            <p className="text-sm font-semibold text-ds-text-primary">
              {NAV.find((n) => n.id === view)?.label}
            </p>
          </div>
          <p className="hidden text-xs text-ds-text-muted sm:block">
            Illustrative content · not legal advice
          </p>
        </header>
        <main className="flex-1 overflow-auto bg-ds-page p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
