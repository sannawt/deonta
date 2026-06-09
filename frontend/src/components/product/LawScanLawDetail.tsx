import type { LawScanResponse, LawScanResult } from "../../lib/api";
import { eurlexInstrumentUrl, lawSummaryForCode } from "../../lib/lawSummaries";
import { lawScanKeywords } from "../../lib/utils";
import { LegalInlineText } from "./LegalInlineText";

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
        <span key={kw} className="ct-law-scan-keyword ct-law-scan-keyword--neutral">
          {kw}
        </span>
      ))}
    </div>
  );
}

export function LawScanLawDetail({ row, scanResponse, shownCount = 0 }: Props) {
  const total =
    scanResponse?.total_match_count ?? scanResponse?.match_count ?? shownCount;

  if (!row) {
    return (
      <div className="ct-workflow-results-empty">
        <p className="ct-muted">Select a regulation on the left to view its details.</p>
      </div>
    );
  }

  const lawCode = row.catalog_code || row.code;
  const catalog = lawSummaryForCode(lawCode);
  const keywords = lawScanKeywords(row);
  const scorePct = Math.round(Math.max(0, Math.min(1, row.score)) * 100);
  const instrumentUrl = eurlexInstrumentUrl(lawCode);

  return (
    <div className="ct-law-scan-detail ct-law-scan-detail--rich">
      {row.number || catalog?.number ? (
        <p className="ct-law-scan-detail-meta">{catalog?.number || row.number}</p>
      ) : null}

      {instrumentUrl ? (
        <p className="ct-law-scan-detail-eurlex">
          <a href={instrumentUrl} target="_blank" rel="noopener noreferrer" className="ct-scope-inline-link">
            Full text on EUR-Lex
            <span className="ct-cite-ext" aria-hidden>
              ↗
            </span>
          </a>
        </p>
      ) : null}

      <div className="ct-law-scan-detail-relevance">
        <div className="ct-law-scan-detail-relevance-row">
          <span className="ct-law-scan-detail-relevance-label">Relevance</span>
          <span className="ct-law-scan-detail-relevance-value">{scorePct}%</span>
        </div>
        <div className="ct-law-scan-bar" aria-hidden>
          <div className="ct-law-scan-bar-fill" style={{ width: `${scorePct}%` }} />
        </div>
        {total > shownCount ? (
          <p className="ct-law-scan-detail-footnote">
            Showing {shownCount} of {total} matches above the relevance threshold.
          </p>
        ) : null}
      </div>

      <section className="ct-law-scan-detail-block">
        <h3 className="ct-law-scan-detail-block-title">Summary</h3>
        <p className="ct-law-scan-detail-text ct-law-scan-detail-prose">
          <LegalInlineText
            text={catalog?.overview || row.summary || row.description || "No summary available."}
            regKey={lawCode}
          />
        </p>
      </section>

      {catalog?.appliesWhen ? (
        <section className="ct-law-scan-detail-block">
          <h3 className="ct-law-scan-detail-block-title">When it typically applies</h3>
          <p className="ct-law-scan-detail-text ct-law-scan-detail-prose">
            <LegalInlineText text={catalog.appliesWhen} regKey={lawCode} />
          </p>
        </section>
      ) : null}

      {row.match_rationale ? (
        <section className="ct-law-scan-detail-block">
          <h3 className="ct-law-scan-detail-block-title">Why it matched your product</h3>
          <p className="ct-law-scan-detail-text ct-law-scan-detail-prose">
            <LegalInlineText text={row.match_rationale} regKey={lawCode} />
          </p>
        </section>
      ) : null}

      {catalog?.keyProvisions?.length ? (
        <section className="ct-law-scan-detail-block">
          <h3 className="ct-law-scan-detail-block-title">Key provisions</h3>
          <ul className="ct-law-scan-provision-list">
            {catalog.keyProvisions.map((prov) => (
              <li key={prov}>
                <LegalInlineText text={prov} regKey={lawCode} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ct-law-scan-detail-block">
        <h3 className="ct-law-scan-detail-block-title">Keywords</h3>
        <KeywordPills keywords={keywords} />
      </section>
    </div>
  );
}
