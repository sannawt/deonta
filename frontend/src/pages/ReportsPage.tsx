import type { ProductRecord } from "../lib/productStore";
import { resolveAssessment } from "../lib/assessment";
import { formatAssessmentRef } from "../lib/assessmentRef";

interface Props {
  products: ProductRecord[];
  onOpenAssessmentDetail?: (productId: string) => void;
  embedded?: boolean;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

export function ReportsPage({ products, onOpenAssessmentDetail, embedded = false }: Props) {
  const assessed = products.filter((p) => p.lastAssessment);

  const content =
    assessed.length === 0 ? (
      <div className="ct-panel ct-block--empty">
        <p className="ct-muted">Complete a regulatory scoping assessment to generate reports</p>
      </div>
    ) : (
      <section className="ct-panel ct-reports-panel" aria-label="Reports">
        <div className="ct-reports-list">
          {assessed.map((product) => {
            const resolved = resolveAssessment(product.lastAssessment?.response);
            const openCount =
              product.lastWorksheet?.open_question_count ??
              resolved?.open_questions?.length ??
              0;
            const frameworkCount =
              product.lastWorksheet?.law_codes.length ??
              (product.spec.selectedLaws?.length ?? 0) + 2;

            return (
              <article key={product.id} className="ct-reports-card">
                <h2 className="ct-reports-card-title">{product.label}</h2>
                <p className="ct-reports-card-meta">
                  {formatAssessmentRef(product.id)} · Assessed{" "}
                  {formatDate(product.lastAssessment!.created_at)}
                </p>
                <p className="ct-reports-card-body">
                  {product.spec.summary?.trim() || "No summary."}
                </p>
                <p className="ct-reports-card-laws">
                  {frameworkCount} frameworks · {openCount} open questions
                </p>
                <button
                  type="button"
                  className="ct-btn-secondary ct-reports-card-btn"
                  onClick={() => onOpenAssessmentDetail?.(product.id)}
                  disabled={!onOpenAssessmentDetail}
                >
                  Open assessment record
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );

  if (embedded) {
    return <div className="ct-reports-embedded">{content}</div>;
  }

  return (
    <div className="ct-page ct-app-page">
      <header className="ct-app-page-header">
        <h1 className="ct-dashboard-title">Reports</h1>
        <p className="ct-page-sub">Saved regulatory scoping worksheets and assessment records</p>
      </header>
      {content}
    </div>
  );
}
