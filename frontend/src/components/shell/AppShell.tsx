import { useState, type ReactNode } from "react";
import { PageFooter } from "./PageFooter";
import { AccountPanel } from "./AccountPanel";
import type { ProductRecord } from "../../lib/productStore";

export type AppRoute =
  | "dashboard"
  | "chat"
  | "product"
  | "law"
  | "monitoring";

interface Props {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  products: ProductRecord[];
  children: ReactNode;
}

const NAV_ITEMS: { route: AppRoute; label: string }[] = [
  { route: "product", label: "Product scan" },
  { route: "chat", label: "Compliance chat" },
  { route: "monitoring", label: "Monitoring" },
];

export function AppShell({ currentRoute, onNavigate, products, children }: Props) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="ct-shell">
      <div className="ct-layout">
        <header className="ct-header">
          <button
            type="button"
            className="ct-logo-btn"
            onClick={() => onNavigate("dashboard")}
          >
            <span className="ct-logo-text" aria-label="ComplianceTwin">
              <span className="ct-logo-c">C</span>omplianceTwin
            </span>
          </button>

          <nav className="ct-header-nav" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.route}
                type="button"
                className={`ct-header-nav-link${currentRoute === item.route ? " ct-header-nav-link--active" : ""}`}
                onClick={() => onNavigate(item.route)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className={`ct-account-btn${accountOpen ? " ct-account-btn--open" : ""}`}
            aria-expanded={accountOpen}
            aria-controls="ct-account-panel"
            onClick={() => setAccountOpen((v) => !v)}
          >
            <span className="ct-account-btn-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span>Account</span>
          </button>
        </header>

        <main className="ct-main">{children}</main>
        <PageFooter />
      </div>

      <AccountPanel
        id="ct-account-panel"
        open={accountOpen}
        products={products}
        onClose={() => setAccountOpen(false)}
        onNavigate={(route) => {
          onNavigate(route);
          setAccountOpen(false);
        }}
      />

      {accountOpen ? (
        <div
          className="ct-account-overlay"
          aria-hidden
          onClick={() => setAccountOpen(false)}
        />
      ) : null}
    </div>
  );
}
