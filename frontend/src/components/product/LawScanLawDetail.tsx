import type { LawScanResponse, LawScanResult } from "../../lib/api";
import { lawNameFromScanRow } from "../../lib/lawDisplayName";
import { keywordColorClass, lawScanKeywords } from "../../lib/utils";

interface Props {
  row: LawScanResult | null;
  scanResponse?: LawScanResponse | null;
  shownCount?: number;
}

function KeywordPills({ keywords }: { keywords: string[] }) {
  if (!keywords.length) {
    return <span className="ct-muted">—</span>;
  }
  return (
    <div className="ct-law-scan-keywords">
      {keywords.map((kw) => (
        <span key={kw} className={`ct-law-scan-keyword ${keywordColorClass(kw)}`}>
          {kw}
        </span>
      ))}
    </div>
  );
}

export function LawScanLawDetail({ row, scanResponse, shownCount = 0 }: Props) {
  const total =
    scanResponse?.total_match_count ??
    scanResponse?.match_count ??
    shownCount;
  const minPct = Math.round((scanResponse?.min_score ?? 0.75) * 100);

  if (!row) {
    return (
      <div className="ct-law-scan-dashboard ct-workflow-results-empty">
        <p className="ct-muted">Select a regulation on the left.</p>
      </div>
    );
  }

  const name = lawNameFromScanRow(row);
  const keywords = lawScanKeywords(row);
  const scorePct = Math.round(Math.max(0, Math.min(1, row.score)) * 100);

  return (
    <div className="ct-law-scan-dashboard">
      <section className="ct-law-scan-dashboard-overview" aria-label="Search overview">
        <h2 className="ct-law-scan-dashboard-heading">Search results</h2>
        <div className="ct-law-scan-dashboard-stats">
          <div className="ct-law-scan-dashboard-stat">
            <span className="ct-law-scan-dashboard-stat-value">{shownCount}</span>
            <span className="ct-law-scan-dashboard-stat-label">Shown</span>
          </div>
          {total > shownCount ? (
            <div className="ct-law-scan-dashboard-stat">
              <span className="ct-law-scan-dashboard-stat-value">{total}</span>
              <span className="ct-law-scan-dashboard-stat-label">Total matches</span>
            </div>
          ) : null}
          <div className="ct-law-scan-dashboard-stat">
            <span className="ct-law-scan-dashboard-stat-value">{minPct}%</span>
            <span className="ct-law-scan-dashboard-stat-label">Min relevance</span>
          </div>
        </div>
      </section>

      <section className="ct-law-scan-dashboard-law" aria-label="Selected law">
        <h3 className="ct-law-scan-dashboard-law-title">{name}</h3>

        <div className="ct-law-scan-detail-score">
          <span className="ct-law-scan-detail-score-label">Relevance</span>
          <div className="ct-law-scan-detail-score-row">
            <span className="ct-law-scan-score">{scorePct}%</span>
            <div className="ct-law-scan-bar" aria-hidden>
              <div className="ct-law-scan-bar-fill" style={{ width: `${scorePct}%` }} />
            </div>
          </div>
        </div>

        {row.summary ? (
          <div className="ct-law-scan-detail-section">
            <h4 className="ct-law-scan-detail-section-title">Summary</h4>
            <p className="ct-law-scan-detail-text">{row.summary}</p>
          </div>
        ) : null}

        {row.match_rationale ? (
          <div className="ct-law-scan-detail-section">
            <h4 className="ct-law-scan-detail-section-title">Why it matched</h4>
            <p className="ct-law-scan-detail-text">{row.match_rationale}</p>
          </div>
        ) : null}

        <div className="ct-law-scan-detail-section">
          <h4 className="ct-law-scan-detail-section-title">Keywords</h4>
          <KeywordPills keywords={keywords} />
        </div>
      </section>
    </div>
  );
}
