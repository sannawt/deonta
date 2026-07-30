import { useEffect, useMemo, useRef } from "react";
import type { ScopeInstrument } from "../../types/chat";
import { useProvisionTexts } from "../../hooks/useProvisionTexts";
import {
  collectLawProvisions,
  groupProvisionsByDimension,
  seedCitationsFromInstrument,
  type ScopeDimensionId,
} from "../../lib/scopeLegalBasis";
import { ScopeProvisionCard } from "./ScopeProvisionCard";

interface Props {
  lawTitle: string;
  instrument?: ScopeInstrument;
  regKey: string;
  selectedProvisionId?: string | null;
  onSelectProvision?: (provisionId: string) => void;
  onDimensionClick?: (dimensionId: ScopeDimensionId) => void;
  onClose: () => void;
}

export function ScopeLegalBasisInspector({
  lawTitle,
  instrument,
  regKey,
  selectedProvisionId,
  onSelectProvision,
  onDimensionClick,
  onClose,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const entries = useMemo(
    () => collectLawProvisions(instrument, regKey),
    [instrument, regKey],
  );
  const groups = useMemo(() => groupProvisionsByDimension(entries), [entries]);
  const seedCitations = useMemo(
    () => seedCitationsFromInstrument(instrument, regKey),
    [instrument, regKey],
  );
  const ids = useMemo(() => entries.map((entry) => entry.provisionLongId), [entries]);
  const { citations, loading, error } = useProvisionTexts(ids, seedCitations);

  useEffect(() => {
    if (!selectedProvisionId || !bodyRef.current) return;
    const el = bodyRef.current.querySelector(
      `#ct-scope-provision-${CSS.escape(selectedProvisionId)}`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedProvisionId, groups]);

  if (!entries.length) {
    return (
      <aside className="ct-scope-inspector" aria-label="Legal basis">
        <header className="ct-scope-inspector-head">
          <div>
            <p className="ct-scope-inspector-eyebrow">Legal basis</p>
            <h3 className="ct-scope-inspector-title">{lawTitle}</h3>
          </div>
          <button type="button" className="ct-scope-inspector-close" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="ct-scope-inspector-empty">No cited provisions for this law yet.</p>
      </aside>
    );
  }

  return (
    <aside className="ct-scope-inspector" aria-label="Legal basis">
      <header className="ct-scope-inspector-head">
        <div>
          <p className="ct-scope-inspector-eyebrow">Legal basis</p>
          <h3 className="ct-scope-inspector-title">{lawTitle}</h3>
          <p className="ct-scope-inspector-meta">{entries.length} provisions cited</p>
        </div>
        <button type="button" className="ct-scope-inspector-close" onClick={onClose}>
          Close
        </button>
      </header>

      {loading ? <p className="ct-scope-inspector-status">Loading provision text…</p> : null}
      {error ? <p className="ct-scope-inspector-error">{error}</p> : null}

      <div className="ct-scope-inspector-body" ref={bodyRef}>
        {groups.map((group) => (
          <section key={group.dimensionId} className="ct-scope-inspector-group">
            <button
              type="button"
              className="ct-scope-inspector-group-title"
              onClick={() => onDimensionClick?.(group.dimensionId)}
            >
              {group.label}
            </button>
            <div className="ct-scope-inspector-group-list">
              {group.provisions.map((entry) => {
                const citation =
                  citations.get(entry.provisionLongId) || entry.citation;
                return (
                  <ScopeProvisionCard
                    key={entry.provisionLongId}
                    citation={citation}
                    scopeNote={entry.scopeNote}
                    selected={selectedProvisionId === entry.provisionLongId}
                    onSelect={() => onSelectProvision?.(entry.provisionLongId)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
