import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import type { AppRoute } from "./AppShell";

const SIDEBAR_COLLAPSED_KEY = "ct_sidebar_collapsed";

interface NavItem {
  route: AppRoute;
  label: string;
}

interface Props {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onNewAssessment?: () => void;
}

function IconCollapse() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { route: "workspace", label: "Workspace" },
  { route: "playbook", label: "Company playbook" },
  { route: "reports", label: "Reports" },
];

function isWorkspaceRoute(route: AppRoute): boolean {
  return route === "workspace" || route === "product" || route === "product-lab";
}

export function AppSidebar({ currentRoute, onNavigate }: Props) {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const profileLabel = email || "Account";

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); }
    catch { /* ignore */ }
  }, [collapsed]);

  return (
    <aside
      className={`ct-sidebar${collapsed ? " ct-sidebar--collapsed" : ""}`}
      aria-label="Application navigation"
    >
      <div className="ct-sidebar-top">
        {collapsed ? (
          <button
            type="button"
            className="ct-sidebar-brand ct-sidebar-brand--mark"
            onClick={() => setCollapsed(false)}
            title="ComplianceTwin — expand"
            aria-label="Expand sidebar"
          >
            <span className="ct-sidebar-brand-mark" aria-hidden>C</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="ct-sidebar-brand"
              onClick={() => onNavigate("workspace")}
              title="ComplianceTwin"
            >
              <span className="ct-sidebar-brand-text">ComplianceTwin</span>
            </button>
            <button
              type="button"
              className="ct-sidebar-collapse-btn"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <IconCollapse />
            </button>
          </>
        )}
      </div>

      <nav className="ct-sidebar-nav" aria-label="Main">
        {collapsed ? (
          <button
            type="button"
            className="ct-sidebar-collapse-btn ct-sidebar-collapse-btn--expand"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            style={{ margin: "8px auto", display: "flex" }}
          >
            <IconExpand />
          </button>
        ) : (
          NAV_ITEMS.map((item) => {
            const active =
              item.route === currentRoute ||
              (item.route === "workspace" && isWorkspaceRoute(currentRoute));
            return (
              <div key={item.route} className="ct-sidebar-nav-group">
                <button
                  type="button"
                  className={`ct-sidebar-nav-item${active ? " ct-sidebar-nav-item--active" : ""}`}
                  onClick={() => onNavigate(item.route)}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className="ct-sidebar-nav-label">{item.label}</span>
                </button>
              </div>
            );
          })
        )}
      </nav>

      <div className="ct-sidebar-footer">
        {!collapsed ? (
          <button
            type="button"
            className="ct-sidebar-profile"
            onClick={() => onNavigate("settings")}
            title={profileLabel}
            aria-label={profileLabel}
          >
            <span className="ct-sidebar-profile-text">
              <span className="ct-sidebar-profile-name">{profileLabel}</span>
            </span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}
