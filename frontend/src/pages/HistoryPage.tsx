import type { ProductRecord } from "../lib/productStore";

interface Props {
  products: ProductRecord[];
  onOpenAssessment: (productId: string) => void;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

export function HistoryPage({ products, onOpenAssessment }: Props) {
  const sorted = [...products].sort((a, b) => b.updated_at - a.updated_at);

  return (
    <div className="ct-page ct-app-page">
      <header className="ct-app-page-header">
        <h1 className="ct-dashboard-title">History</h1>
      </header>

      {sorted.length === 0 ? (
        <div className="ct-panel ct-block--empty">
          <p className="ct-muted">No assessment history yet</p>
        </div>
      ) : (
        <section className="ct-panel ct-history-panel" aria-label="Assessment history">
          <div className="ct-history-list">
            {sorted.map((product) => (
              <button
                key={product.id}
                type="button"
                className="ct-history-row"
                onClick={() => onOpenAssessment(product.id)}
              >
                <span className="ct-history-row-title">{product.label}</span>
                <span className="ct-history-row-date">{formatDate(product.updated_at)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
