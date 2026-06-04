import type { LawScanResult } from "../../lib/api";

interface Props {
  results: LawScanResult[];
  selectedCodes: string[];
  loading?: boolean;
  onToggle: (code: string) => void;
  onCheckApplicability: () => void;
  onBack: () => void;
}

function scorePercent(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

export function LawScanResults({
  results,
  selectedCodes,
  loading,
  onToggle,
  onCheckApplicability,
  onBack,
}: Props) {
  if (!results.length && !loading) {
    return (
      <>
        <p className="ct-muted">No matching regulations found. Try a longer product description.</p>
        <div className="ct-scanner-actions">
          <button type="button" className="ct-btn-outline ct-scanner-action-btn" onClick={onBack}>
            Go back
          </button>
        </div>
      </>
    );
  }

  const canCheck = selectedCodes.length > 0 && !loading;

  return (
    <div className="ct-law-scan">
      <table className="ct-table ct-law-scan-table">
        <thead>
          <tr>
            <th className="ct-law-scan-check" aria-label="Select" />
            <th>Short</th>
            <th>Number</th>
            <th>Description</th>
            <th>Match</th>
            <th>Relevance</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.code}>
              <td className="ct-law-scan-check">
                <input
                  type="checkbox"
                  checked={selectedCodes.includes(row.code)}
                  onChange={() => onToggle(row.code)}
                  aria-label={`Select ${row.short}`}
                />
              </td>
              <td>{row.short}</td>
              <td>{row.number}</td>
              <td>{row.description}</td>
              <td className="ct-muted">{row.match_rationale || "—"}</td>
              <td>
                <span className="ct-law-scan-score" title={scorePercent(row.score)}>
                  <span
                    className="ct-law-scan-bar"
                    style={{ width: scorePercent(row.score) }}
                  />
                  {scorePercent(row.score)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ct-scanner-actions">
        <button
          type="button"
          className="ct-btn-primary ct-scanner-action-btn"
          disabled={!canCheck}
          onClick={onCheckApplicability}
        >
          Check applicability
        </button>
        <button
          type="button"
          className="ct-btn-outline ct-scanner-action-btn"
          disabled={loading}
          onClick={onBack}
        >
          Go back
        </button>
      </div>
    </div>
  );
}
