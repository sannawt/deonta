import { useEffect, useState } from "react";
import { fetchLaws, type LawCatalogItem } from "../lib/api";
import { lawSummaryForCode } from "../lib/lawSummaries";
import { ThinkingSpinner } from "../components/ui/ThinkingSpinner";
import { LegalInlineText } from "../components/product/LegalInlineText";

export function LibraryPage() {
  const [laws, setLaws] = useState<LawCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchLaws()
      .then((rows) => {
        setLaws(rows);
        if (rows[0]) setFocused(rows[0].code);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load laws"))
      .finally(() => setLoading(false));
  }, []);

  const selected = laws.find((law) => law.code === focused);
  const summary = selected ? lawSummaryForCode(selected.code) : null;

  return (
    <div className="ct-page ct-app-page ct-library-page">
      <header className="ct-app-page-header">
        <h1 className="ct-dashboard-title">Regulatory library</h1>
      </header>

      {error ? <div className="err">{error}</div> : null}

      {loading ? (
        <ThinkingSpinner active label="Loading regulations…" size={44} />
      ) : (
        <div className="ct-library-split">
          <aside className="ct-library-list" aria-label="Regulations">
            {laws.map((law) => (
              <button
                key={law.code}
                type="button"
                className={`ct-library-list-item${focused === law.code ? " ct-library-list-item--active" : ""}`}
                onClick={() => setFocused(law.code)}
              >
                <span className="ct-library-list-short">{law.short || law.label}</span>
                <span className="ct-library-list-label">{law.label}</span>
              </button>
            ))}
          </aside>

          <section className="ct-library-detail">
            {selected && summary ? (
              <>
                <h2 className="ct-library-detail-title">{summary.title}</h2>
                <p className="ct-library-detail-number">{summary.number}</p>
                <p className="ct-library-detail-prose">
                  <LegalInlineText text={summary.overview} regKey={selected.code} />
                </p>
                <p className="ct-library-detail-prose">
                  <LegalInlineText text={summary.appliesWhen} regKey={selected.code} />
                </p>
                {summary.keyProvisions?.length ? (
                  <ul className="ct-law-scan-provision-list">
                    {summary.keyProvisions.map((prov) => (
                      <li key={prov}>
                        <LegalInlineText text={prov} regKey={selected.code} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : selected ? (
              <p className="ct-muted">Summary not available for {selected.label}.</p>
            ) : (
              <p className="ct-muted">Select a regulation.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
