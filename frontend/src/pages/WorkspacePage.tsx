import type { ProductRecord } from "../lib/productStore";
import { resolveAssessment } from "../lib/assessment";

interface Props {
  products: ProductRecord[];
  onNewAssessment: () => void;
  onOpenAssessment: (productId: string) => void;
  onOpenAssessmentDetail: (productId: string) => void;
  onPlaybook: () => void;
  onOpenHistory?: () => void;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ts));
}

function assessmentMeta(product: ProductRecord): string {
  const frameworks =
    product.lastWorksheet?.law_codes.length ??
    product.lastObligations?.law_codes.length ??
    product.spec.selectedLaws?.length ??
    0;
  const resolved = resolveAssessment(product.lastAssessment?.response);
  const openQuestions =
    product.lastWorksheet?.open_question_count ??
    resolved?.open_questions?.length ??
    0;
  const parts: string[] = [];
  if (frameworks > 0) parts.push(`${frameworks} frameworks`);
  if (openQuestions > 0) parts.push(`${openQuestions} open questions`);
  parts.push(formatDate(product.updated_at));
  return parts.join(" · ");
}

export function WorkspacePage({
  products,
  onNewAssessment,
  onOpenAssessment,
  onOpenAssessmentDetail,
  onPlaybook,
  onOpenHistory,
}: Props) {
  const recent = [...products].sort((a, b) => b.updated_at - a.updated_at).slice(0, 5);
  const hasMore = products.length > recent.length;

  function openProduct(product: ProductRecord) {
    if (product.lastWorksheet) {
      onOpenAssessmentDetail(product.id);
    } else {
      onOpenAssessment(product.id);
    }
  }

  return (
    <div className="ct-page ct-app-page ct-workspace-page">
      <section className="ct-dashboard-welcome">
        <h1 className="ct-dashboard-title">Workspace</h1>
      </section>

      <section className="ct-dashboard-actions ct-dashboard-actions--duo" aria-label="Get started">
        <button
          type="button"
          className="ct-dashboard-action-card ct-dashboard-action-card--text"
          onClick={onNewAssessment}
        >
          <div className="ct-dashboard-action-text">
            <h2 className="ct-dashboard-action-title">New assessment</h2>
            <p className="ct-dashboard-action-desc">
              Product facts → relevant laws → scope analysis → obligations → review worksheet
            </p>
          </div>
          <span className="ct-dashboard-action-arrow" aria-hidden>
            →
          </span>
        </button>

        <button
          type="button"
          className="ct-dashboard-action-card ct-dashboard-action-card--text"
          onClick={onPlaybook}
        >
          <div className="ct-dashboard-action-text">
            <h2 className="ct-dashboard-action-title">Company context</h2>
            <p className="ct-dashboard-action-desc">
              Policies, DPAs, and vendor documents for assessments
            </p>
          </div>
          <span className="ct-dashboard-action-arrow" aria-hidden>
            →
          </span>
        </button>
      </section>

      <section className="ct-workspace-history-panel" aria-label="Assessment history">
        <h2 className="ct-workspace-history-title">Recent assessments</h2>

        {recent.length === 0 ? (
          <p className="ct-workspace-history-empty">No previous assessments yet</p>
        ) : (
          <ul className="ct-workspace-history-list">
            {recent.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  className="ct-workspace-history-item"
                  onClick={() => openProduct(product)}
                >
                  <span className="ct-workspace-history-item-name">{product.label}</span>
                  <span className="ct-workspace-history-item-date">{assessmentMeta(product)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasMore && onOpenHistory ? (
          <button type="button" className="ct-workspace-history-more" onClick={onOpenHistory}>
            View all
          </button>
        ) : null}
      </section>
    </div>
  );
}
