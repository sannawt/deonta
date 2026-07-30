import type { ReactNode } from "react";
import { PageFooter } from "./PageFooter";
import { AppSidebar } from "./AppSidebar";

export type AppRoute =
  | "dashboard"
  | "workspace"
  | "history"
  | "reports"
  | "ai-governance"
  | "assessment-detail"
  | "settings"
  | "chat"
  | "playbook"
  | "product"
  | "product-lab"
  | "law"
  | "design-system";

interface Props {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onNewAssessment: () => void;
  children: ReactNode;
}

export function AppShell({ currentRoute, onNavigate, onNewAssessment, children }: Props) {
  if (currentRoute === "design-system") {
    return <>{children}</>;
  }

  return (
    <div className="ct-shell">
      <AppSidebar
        currentRoute={currentRoute}
        onNavigate={onNavigate}
        onNewAssessment={onNewAssessment}
      />

      <div className="ct-app-main">
        <div className="ct-layout">
          <main className="ct-main">{children}</main>
          <PageFooter />
        </div>
      </div>
    </div>
  );
}
