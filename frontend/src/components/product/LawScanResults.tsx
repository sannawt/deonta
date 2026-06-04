import type { LawScanResult } from "../../lib/api";
import { PixelIcon } from "../ui/PixelIcon";

interface Props {
  results: LawScanResult[];
  selectedCodes: string[];
  loading?: boolean;
  onToggle: (code: string) => void;
  onRescan: () => void;
}

function scorePercent(score: number): string {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

export function LawScanResults({
  results,
  selectedCodes,
  loading,
  onToggle,
  onRescan,
}: Props) {
  if (!results.length && !loading) {
    return <p className="ct-muted">No matching regulations found. Try a longer product description.</p>;
  }

  return (
    <div className="ct-law-scan">
      <table className="ct-table ct-law-scan-table">
        <thead>
          <tr>
            <th className="ct-law-scan-check" aria-label="Select" />
            <th>Short</th>
            <th>Number</th>
            <th>Description</th>
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
      <p className="ct-text-link-row">
        <button
          type="button"
          className="ct-text-link ct-text-link-primary ct-link-with-icon"
          disabled={loading}
          onClick={onRescan}
        >
          <PixelIcon name="scale" size={22} className="ct-link-icon" />
          {loading ? "Searching…" : "Scan legal database"}
        </button>
      </p>
    </div>
  );
}
