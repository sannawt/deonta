import { useEffect, useState } from "react";
import { getStoredAccountId, ensureAccountId } from "../../lib/account";
import type { AppRoute } from "./AppShell";

interface Props {
  id: string;
  open: boolean;
  products: { id: string; label: string; updated_at: number }[];
  onClose: () => void;
  onNavigate: (route: AppRoute) => void;
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(-8);
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

export function AccountPanel({ id, open, products, onClose, onNavigate }: Props) {
  const [accountId, setAccountId] = useState<string | null>(() => getStoredAccountId());
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (open) setAccountId(getStoredAccountId());
  }, [open]);

  async function handleCopy() {
    if (!accountId) return;
    await navigator.clipboard.writeText(accountId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleReset() {
    if (!confirm("This will clear your session and start a new one. Continue?")) return;
    setResetting(true);
    localStorage.removeItem("ct_account_id");
    localStorage.removeItem("ct_products_v1");
    try {
      const newId = await ensureAccountId();
      setAccountId(newId);
    } finally {
      setResetting(false);
    }
    window.location.reload();
  }

  const recentProducts = [...products]
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, 5);

  return (
    <aside
      id={id}
      className={`ct-account-panel${open ? " ct-account-panel--open" : ""}`}
      aria-label="Account panel"
      aria-hidden={!open}
    >
      <header className="ct-account-panel-head">
        <h2 className="ct-account-panel-title">Account</h2>
        <button
          type="button"
          className="ct-account-panel-close"
          onClick={onClose}
          aria-label="Close account panel"
        >
          ✕
        </button>
      </header>

      <section className="ct-account-panel-section">
        <h3 className="ct-account-panel-section-title">Session</h3>
        <div className="ct-account-panel-session">
          <span className="ct-account-panel-session-label">Session ID</span>
          <div className="ct-account-panel-session-row">
            <code className="ct-account-panel-session-id">
              ···{shortId(accountId)}
            </code>
            <button
              type="button"
              className="ct-account-panel-copy"
              onClick={handleCopy}
              title="Copy full ID"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="ct-account-panel-session-note">
            Anonymous session stored locally. No account or login required.
          </p>
        </div>
      </section>

      <section className="ct-account-panel-section">
        <h3 className="ct-account-panel-section-title">
          Saved products
          {products.length > 0 ? (
            <span className="ct-account-panel-count">{products.length}</span>
          ) : null}
        </h3>
        {recentProducts.length === 0 ? (
          <p className="ct-account-panel-empty">No products scanned yet.</p>
        ) : (
          <ul className="ct-account-panel-product-list">
            {recentProducts.map((p) => (
              <li key={p.id} className="ct-account-panel-product-row">
                <span className="ct-account-panel-product-name">{p.label}</span>
                <span className="ct-account-panel-product-date">{formatDate(p.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ct-account-panel-section">
        <h3 className="ct-account-panel-section-title">Quick actions</h3>
        <div className="ct-account-panel-actions">
          <button
            type="button"
            className="ct-btn-primary ct-account-panel-action-btn"
            onClick={() => onNavigate("product")}
          >
            Start new scan
          </button>
          <button
            type="button"
            className="ct-btn-outline ct-account-panel-action-btn"
            onClick={() => onNavigate("chat")}
          >
            Open chat
          </button>
        </div>
      </section>

      <footer className="ct-account-panel-footer">
        <button
          type="button"
          className="ct-account-panel-reset"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? "Resetting…" : "Clear session"}
        </button>
      </footer>
    </aside>
  );
}
