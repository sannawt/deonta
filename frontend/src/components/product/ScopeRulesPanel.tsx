import type { ScannedLawItem } from "../../lib/applicabilityScan";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";

interface Props {
  items: ScannedLawItem[];
  focusedCode: string | null;
  onSelect: (code: string) => void;
}

export function ScopeRulesPanel({ items, focusedCode, onSelect }: Props) {
  return (
    <section
      className="ct-applicability-box ct-applicability-box--rules"
      aria-labelledby="scope-rules-title"
    >
      <h3 className="ct-applicability-box-title" id="scope-rules-title">
        Core frameworks (deterministic scope)
      </h3>
      <ul className="ct-applicability-law-list">
        {items.map((item) => {
          const active = item.rowCode === focusedCode;
          return (
            <li key={item.rowCode}>
              <button
                type="button"
                className={`ct-applicability-law-row${active ? " ct-applicability-law-row--active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(item.rowCode)}
              >
                <span className="ct-applicability-law-row-lock" aria-hidden title="Always included">
                  ⧉
                </span>
                <span className="ct-applicability-law-row-label">{lawNameFromScannedItem(item)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
