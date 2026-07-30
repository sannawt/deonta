import type { ScannedLawItem } from "../../lib/applicabilityScan";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";

interface Props {
  items: ScannedLawItem[];
  focusedCode: string | null;
  loading?: boolean;
  onSelect: (code: string) => void;
  onToggleInclude: (code: string) => void;
}

const CATALOG_MATCH_BOILERPLATE = "Matched from EU law catalog for your product profile";

export function DiscoveredLawsPanel({
  items,
  focusedCode,
  loading,
  onSelect,
  onToggleInclude,
}: Props) {
  return (
    <section
      className="ct-applicability-box ct-applicability-box--discovery"
      aria-labelledby="discovered-laws-title"
    >
      <h3 className="ct-applicability-box-title" id="discovered-laws-title">
        Additional frameworks to consider
      </h3>
      {loading ? (
        <p className="ct-muted">Scanning…</p>
      ) : items.length === 0 ? (
        <p className="ct-muted">No additional laws found above the relevance threshold.</p>
      ) : (
        <ul className="ct-applicability-law-list">
          {items.map((item) => {
            const active = item.rowCode === focusedCode;
            const rationale = item.scanRow?.match_rationale?.trim();
            const showRationale =
              rationale &&
              rationale !== CATALOG_MATCH_BOILERPLATE &&
              !/^matched from eu law catalog/i.test(rationale);

            return (
              <li key={item.rowCode}>
                <div
                  className={`ct-applicability-law-row ct-applicability-law-row--discovery${active ? " ct-applicability-law-row--active" : ""}${item.selected ? "" : " ct-applicability-law-row--excluded"}`}
                >
                  <label className="ct-applicability-law-check">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => onToggleInclude(item.rowCode)}
                      aria-label={`Include ${lawNameFromScannedItem(item)}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="ct-applicability-law-row-main"
                    onClick={() => onSelect(item.rowCode)}
                  >
                    <span className="ct-applicability-law-row-label">{lawNameFromScannedItem(item)}</span>
                  </button>
                </div>
                {showRationale ? (
                  <p className="ct-applicability-law-rationale">{rationale}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
