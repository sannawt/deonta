import type { ReactNode } from "react";

export type AppRoute =
  | "start"
  | "product"
  | "law"
  | "monitoring";

interface Props {
  onNavigateHome: () => void;
  children: ReactNode;
}

export function AppShell({ onNavigateHome, children }: Props) {
  return (
    <div className="ct-shell">
      <div className="ct-layout">
        <header className="ct-header">
          <button type="button" className="ct-logo-btn" onClick={onNavigateHome}>
            <span className="ct-logo-text" aria-label="ComplianceTwin">
              <span className="ct-logo-c" style={{ color: "#2d6be4" }}>C</span>
              omplianceTwin
            </span>
          </button>
        </header>

        <main className="ct-main">{children}</main>
      </div>
    </div>
  );
}
