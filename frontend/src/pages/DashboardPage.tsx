import type { ProductRecord } from "../lib/productStore";
import { PixelIcon } from "../components/ui/PixelIcon";

const EU_INSTRUMENTS = [
  { short: "GDPR", full: "General Data Protection Regulation" },
  { short: "AI Act", full: "Artificial Intelligence Act" },
  { short: "NIS2", full: "Network and Information Security Directive 2" },
  { short: "CRA", full: "Cyber Resilience Act" },
  { short: "DSA", full: "Digital Services Act" },
  { short: "DMA", full: "Digital Markets Act" },
  { short: "PLD", full: "Product Liability Directive" },
  { short: "RoHS", full: "Restriction of Hazardous Substances Directive" },
];

interface Props {
  products: ProductRecord[];
  onProductPath: () => void;
  onChatPath: () => void;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

function assessmentBadge(product: ProductRecord): { label: string; tone: string } {
  if (!product.lastAssessment) return { label: "Not assessed", tone: "neutral" };
  return { label: "Assessed", tone: "done" };
}

export function DashboardPage({ products, onProductPath, onChatPath }: Props) {
  const recentProducts = [...products]
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, 4);

  return (
    <div className="ct-dashboard">
      <section className="ct-dashboard-welcome">
        <div className="ct-dashboard-welcome-text">
          <h1 className="ct-dashboard-title">ComplianceTwin</h1>
          <p className="ct-dashboard-subtitle">
            Understand which EU laws apply to your product — step by step.
          </p>
        </div>
      </section>

      <section className="ct-dashboard-actions" aria-label="Quick actions">
        <button
          type="button"
          className="ct-dashboard-action-card"
          onClick={onProductPath}
        >
          <div className="ct-dashboard-action-icon">
            <PixelIcon name="productConsole" size={48} />
          </div>
          <div className="ct-dashboard-action-text">
            <h2 className="ct-dashboard-action-title">Product scan</h2>
            <p className="ct-dashboard-action-body">
              Describe your product in three guided steps. Build a knowledge graph,
              scan relevant EU laws, and get an applicability verdict.
            </p>
          </div>
          <span className="ct-dashboard-action-arrow" aria-hidden>→</span>
        </button>

        <button
          type="button"
          className="ct-dashboard-action-card"
          onClick={onChatPath}
        >
          <div className="ct-dashboard-action-icon">
            <PixelIcon name="legalSand" size={48} />
          </div>
          <div className="ct-dashboard-action-text">
            <h2 className="ct-dashboard-action-title">Compliance chat</h2>
            <p className="ct-dashboard-action-body">
              Ask questions in plain language. Get answers on GDPR, AI Act,
              and other EU regulations.
            </p>
          </div>
          <span className="ct-dashboard-action-arrow" aria-hidden>→</span>
        </button>
      </section>

      {recentProducts.length > 0 ? (
        <section className="ct-dashboard-section" aria-label="Recent products">
          <h2 className="ct-dashboard-section-title">Recent products</h2>
          <div className="ct-dashboard-product-list">
            {recentProducts.map((product) => {
              const badge = assessmentBadge(product);
              return (
                <div key={product.id} className="ct-dashboard-product-row">
                  <div className="ct-dashboard-product-info">
                    <span className="ct-dashboard-product-name">{product.label}</span>
                    <span className="ct-dashboard-product-date">
                      {formatDate(product.updated_at)}
                    </span>
                  </div>
                  <span className={`ct-dashboard-product-badge ct-dashboard-product-badge--${badge.tone}`}>
                    {badge.label}
                  </span>
                  <button
                    type="button"
                    className="ct-btn-outline ct-dashboard-product-btn"
                    onClick={onProductPath}
                  >
                    Continue
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="ct-dashboard-section" aria-label="Covered regulations">
        <h2 className="ct-dashboard-section-title">Covered EU instruments</h2>
        <div className="ct-dashboard-instruments">
          {EU_INSTRUMENTS.map((inst) => (
            <div key={inst.short} className="ct-dashboard-instrument">
              <span className="ct-dashboard-instrument-short">{inst.short}</span>
              <span className="ct-dashboard-instrument-full">{inst.full}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
