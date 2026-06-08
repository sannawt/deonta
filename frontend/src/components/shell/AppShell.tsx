import type { ReactNode } from "react";
import { InstanceBadge } from "./InstanceBadge";
import { PageFooter } from "./PageFooter";

export type AppRoute =
  | "start"
  | "chat"
  | "product"
  | "law"
  | "monitoring";

interface Props {
  uiMode?: "chat" | "workflow";
  peerUrl?: string;
  onNavigateHome: () => void;
  children: ReactNode;
}

export function AppShell({ uiMode = "workflow", peerUrl, onNavigateHome, children }: Props) {
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
          <InstanceBadge uiMode={uiMode} peerUrl={peerUrl} />
        </header>

        <main className="ct-main">{children}</main>
        <PageFooter />
      </div>
    </div>
  );
}
