import { useMemo } from "react";
import { type ScannedLawItem, type LawScanStatus } from "../../lib/applicabilityScan";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";

interface Props {
  items: ScannedLawItem[];
  focusedCode: string | null;
  onSelect: (rowCode: string) => void;
}

interface StatusTag {
  label: string;
  tone: "in" | "review" | "out" | "neutral";
}

function statusTag(status: LawScanStatus): StatusTag {
  switch (status) {
    case "confirmed":
      return { label: "Likely applicable", tone: "in" };
    case "assessment_required":
      return { label: "Needs review", tone: "review" };
    case "potential":
      return { label: "Pending", tone: "neutral" };
    case "excluded":
      return { label: "Not likely", tone: "out" };
  }
}

export function ScopeLawSidebar({ items, focusedCode, onSelect }: Props) {
  const visibleItems = useMemo(
    () => items.filter((item) => item.selected),
    [items],
  );

  if (!visibleItems.length) {
    return (
      <nav className="ct-law-scan-sidebar" aria-label="Selected laws">
        <p className="ct-workflow-actions-empty">No laws selected.</p>
      </nav>
    );
  }

  return (
    <nav className="ct-law-scan-sidebar" aria-label="Selected laws">
      <ul className="ct-law-scan-sidebar-list">
        {visibleItems.map((item) => {
          const active = item.rowCode === focusedCode;
          const tag = statusTag(item.status);
          return (
            <li key={item.rowCode}>
              <button
                type="button"
                className={`ct-law-scan-sidebar-item ct-law-scan-sidebar-btn${active ? " ct-law-scan-sidebar-item--active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(item.rowCode)}
              >
                <span className="ct-law-scan-sidebar-label">
                  {lawNameFromScannedItem(item)}
                </span>
                <span className={`ct-law-list-tag ct-law-list-tag--scope-${tag.tone}`}>
                  {tag.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
