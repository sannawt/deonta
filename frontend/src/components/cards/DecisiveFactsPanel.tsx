import { useMemo, useState } from "react";
import type { ClarifyingQuestion, ApplicabilityResult } from "../../types/chat";
import { predicateOnlyFromAtom, stripInternalIds } from "../../lib/utils";

interface Props {
  questions: ClarifyingQuestion[];
  results: Record<string, ApplicabilityResult>;
  onAnswer: (text: string) => void;
}

export function DecisiveFactsPanel({ questions, results, onAnswer }: Props) {
  const missingAtoms = Object.values(results).flatMap((r) => r.missing_atoms || []);
  const allItems = useMemo(() => {
    const qItems = questions.map((q) => ({
      raw: q.text || q.missing_atom || "",
      display: stripInternalIds(q.text || q.missing_atom || ""),
      type: "question" as const,
    }));
    const atomItems = missingAtoms
      .filter((a) => !questions.some((q) => q.missing_atom === a))
      .map((a) => ({
        raw: a,
        display: predicateOnlyFromAtom(a),
        type: "atom" as const,
      }));
    return [...qItems, ...atomItems].filter((i) => i.display.trim().length > 0);
  }, [missingAtoms, questions]);

  const [selected, setSelected] = useState<Record<number, boolean>>({});

  if (allItems.length === 0) return null;

  const selectedIdxs = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => Number(k))
    .filter((n) => Number.isFinite(n));
  const selectedItems = selectedIdxs.map((i) => allItems[i]).filter(Boolean);

  function toggle(i: number) {
    setSelected((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function selectAll(v: boolean) {
    if (!v) return setSelected({});
    const next: Record<number, boolean> = {};
    allItems.forEach((_, i) => (next[i] = true));
    setSelected(next);
  }

  function assertItems(items: Array<{ display: string }>) {
    const clean = items.map((x) => x.display).filter(Boolean);
    if (clean.length === 0) return;
    const msg =
      clean.length === 1
        ? `Yes, confirm: ${clean[0]}`
        : `Yes, confirm the following facts:\n` + clean.map((t) => `- ${t}`).join("\n");
    onAnswer(msg);
  }

  return (
    <div className="dec-panel">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px dashed #fde68a",
        }}
      >
        <div>
          <div className="text-title" style={{ color: "#78350f" }}>
            Decisive facts still missing
          </div>
          <p className="text-sm" style={{ color: "#92400e", marginTop: 4 }}>
            Each item below is one fact away from changing the scope verdict.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="badge badge-amber">{allItems.length} to close</span>
          <button
            type="button"
            onClick={() => selectAll(true)}
            style={{
              fontSize: "var(--fs-xs)",
              padding: "5px 10px",
              borderRadius: 7,
              border: "1px solid var(--bdr)",
              background: "#fff",
              color: "var(--txt3)",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => selectAll(false)}
            style={{
              fontSize: "var(--fs-xs)",
              padding: "5px 10px",
              borderRadius: 7,
              border: "1px solid var(--bdr)",
              background: "#fff",
              color: "var(--txt3)",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => assertItems(selectedItems)}
            disabled={selectedItems.length === 0}
            style={{
              fontSize: "var(--fs-xs)",
              padding: "5px 10px",
              borderRadius: 7,
              border: "1px solid rgba(5,150,105,.3)",
              background: "#fff",
              color: "var(--green)",
              fontWeight: 700,
              cursor: selectedItems.length === 0 ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: selectedItems.length === 0 ? 0.5 : 1,
            }}
          >
            Assert selected
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {allItems.map((item, i) => (
          <div key={i} className="dec-item">
            <input
              type="checkbox"
              checked={!!selected[i]}
              onChange={() => toggle(i)}
              aria-label="Select"
              style={{ marginTop: 3 }}
            />
            <span className={`dec-item-text${item.type === "atom" ? " mono" : ""}`}>
              {item.display}
            </span>
            <button
              type="button"
              onClick={() => assertItems([item])}
              style={{
                fontSize: "var(--fs-xs)",
                padding: "6px 12px",
                borderRadius: 7,
                border: "1px solid rgba(5,150,105,.3)",
                background: "#fff",
                color: "var(--green)",
                fontWeight: 600,
                flexShrink: 0,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Assert SATISFIED
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
