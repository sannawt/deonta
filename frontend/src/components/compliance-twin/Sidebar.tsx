import type { ProductRecord } from "../../lib/productStore";

const PLAYBOOK_LABELS: Record<string, string> = {
  vaisala: "Vaisala",
  iloq: "Iloq",
  atlascopco: "Atlas Copco",
};

function LogoMark({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <svg width="32" height="32" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 7L9 7L9 41L18 41" stroke="var(--blue-dk)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M30 7L39 7L39 41L30 41" stroke="var(--blue)" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="4" fill="var(--blue)" />
      </svg>
    );
  }
  return (
    <svg width="188" height="40" viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6 L8 6 L8 42 L18 42" fill="none" stroke="var(--blue-dk)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 6 L40 6 L40 42 L30 42" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="3.5" fill="var(--blue)" />
      <text x="56" y="31" fontFamily="'Plus Jakarta Sans',Arial,sans-serif" fontSize="17" fontWeight="700" fill="var(--txt)" letterSpacing="-0.3">
        ComplianceTwin
      </text>
    </svg>
  );
}

export type PrimaryView = "wizard" | "products" | "regulations" | "evidence" | "playbook";

interface Props {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  playbookCompanyId?: string;

  view: PrimaryView;
  onNavigate: (v: PrimaryView) => void;

  products: ProductRecord[];
  activeProductId: string | null;
  onSelectProduct: (id: string) => void;
  onResetUi?: () => void;
}

export function Sidebar({
  products,
  activeProductId,
  playbookCompanyId,
  collapsed = false,
  onToggleCollapse,
  view,
  onNavigate,
  onSelectProduct,
  onResetUi,
}: Props) {
  const playbookLabel = playbookCompanyId
    ? PLAYBOOK_LABELS[playbookCompanyId] || "Company playbook"
    : "No company playbook";

  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
      <div className="sidebar-top">
        {collapsed ? <LogoMark compact /> : <LogoMark />}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="sb-sec">Active context</div>
          <div className="sidebar-context-card">
            <div className="text-sm text-strong">{playbookLabel}</div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
              Company playbook (select in assessment panel)
            </div>
          </div>

          <div className="sidebar-actions">
            <button type="button" className="new-btn" onClick={() => onNavigate("wizard")}>
              + New assessment
            </button>
            {onResetUi && (
              <button type="button" className="hdr-btn sidebar-reset-btn" onClick={onResetUi}>
                Reset sessions
              </button>
            )}
          </div>

          <div className="sidebar-sessions">
            <div className="sb-sec sidebar-sessions-label">Workspace</div>
            {(
              [
                ["wizard", "New assessment"],
                ["products", "Products"],
                ["regulations", "Regulations"],
                ["evidence", "Evidence"],
                ["playbook", "Playbook"],
              ] as Array<[PrimaryView, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={`sess-item${view === id ? " active" : ""}`}
              >
                <div className="sb-item-title">{label}</div>
                <div className="sb-item-sub">{id === "wizard" ? "Structured intake → record" : "Browse and review"}</div>
              </button>
            ))}
          </div>

          <div className="sidebar-sessions" style={{ marginTop: 4 }}>
            <div className="sb-sec sidebar-sessions-label">Recent products</div>
            {products.length === 0 && (
              <div className="text-xs text-muted" style={{ textAlign: "center", marginTop: 12 }}>
                No products yet
              </div>
            )}
            {products.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProduct(p.id)}
                className={`sess-item${p.id === activeProductId ? " active" : ""}`}
              >
                <div className="sb-item-title">{p.label}</div>
                <div className="sb-item-sub">{p.lastAssessment ? "Assessment saved" : "No assessment yet"}</div>
              </button>
            ))}
          </div>

          <div className="user-foot">
            <div className="user-av">U</div>
            <div>
              <div className="text-sm text-strong">User</div>
              <div className="text-xs text-muted">Compliance Manager</div>
            </div>
          </div>
        </>
      )}

      {collapsed && (
        <div className="sidebar-rail">
          <button type="button" className="sidebar-rail-btn" onClick={() => onNavigate("wizard")} title="New assessment">
            +
          </button>
          <div className="sidebar-rail-sessions">
            {products.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sidebar-rail-dot${p.id === activeProductId ? " active" : ""}`}
                onClick={() => onSelectProduct(p.id)}
                title={p.label || "Product"}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
