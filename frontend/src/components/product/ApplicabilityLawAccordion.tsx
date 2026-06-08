import { useMemo, useState } from "react";
import type { ClarifyingQuestion, ScopeInstrument } from "../../types/chat";
import {
  buildLawVerdictDetail,
  filterQuestionsForLaw,
  type ScannedLawItem,
} from "../../lib/applicabilityScan";
import { humanizeMissingQuestion } from "../../lib/plainLanguage";
import { ScopeDimensionCard } from "./ScopeDimensionCard";

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"];

interface Props {
  item: ScannedLawItem;
  instrument?: ScopeInstrument;
  openQuestions?: ClarifyingQuestion[];
  defaultOpen?: boolean;
  onFocus?: () => void;
}

export function ApplicabilityLawAccordion({
  item,
  instrument,
  openQuestions = [],
  defaultOpen = false,
  onFocus,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const lawCode = item.scanRow?.catalog_code || item.scanRow?.code || item.rowCode;
  const lawQuestions = filterQuestionsForLaw(openQuestions, lawCode);
  const detail = buildLawVerdictDetail({ item, instrument, openQuestions: lawQuestions });

  const dimensions = [...(instrument?.dimensions ?? [])].sort((a, b) => {
    const ai = DIM_ORDER.indexOf(a.id);
    const bi = DIM_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const instrumentMissing = (instrument?.missing_facts ?? instrument?.missing_atoms ?? [])
    .map((m) => humanizeMissingQuestion(m))
    .filter(Boolean);

  const summaryProse = useMemo(() => {
    const parts: string[] = [];
    if (detail.summary) {
      parts.push(detail.summary);
    } else if (!dimensions.length && !detail.legalTests.length) {
      parts.push(
        "Scope gates for material, territorial, temporal, and exclusion tests are listed below.",
      );
    }
    parts.push(`Confidence: ${detail.confidence}.`);
    for (const t of detail.legalTests) {
      parts.push(`${t.label} ${t.answer}.`);
    }
    if (instrumentMissing.length) {
      parts.push(`Open questions: ${instrumentMissing.join("; ")}.`);
    }
    return parts.join(" ");
  }, [detail, dimensions.length, instrumentMissing]);

  const lawTitle =
    item.fullLabel && item.fullLabel !== item.listLabel
      ? `${item.listLabel} — ${item.fullLabel}`
      : item.listLabel;

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) onFocus?.();
      return next;
    });
  };

  return (
    <div className={`ct-scope-law-panel ct-scope-law-${item.status}${open ? " open" : ""}`}>
      <button type="button" className="ct-scope-law-panel-head" onClick={toggle}>
        <span className="ct-scope-prose ct-scope-law-panel-title">
          {lawTitle} — {detail.verdict}
        </span>
        <span className="ct-scope-law-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="ct-scope-law-panel-body">
          <p className="ct-scope-prose">{summaryProse}</p>

          {dimensions.length > 0 ? (
            <div className="ct-scope-dim-stack">
              {dimensions.map((dim) => (
                <ScopeDimensionCard
                  key={dim.id}
                  dim={dim}
                  openQuestions={lawQuestions}
                  defaultOpen={dim.result === "UNKNOWN" || dim.result === "FAIL"}
                />
              ))}
            </div>
          ) : detail.legalTests.length === 0 ? (
            <p className="ct-scope-prose">No scope dimension breakdown for this instrument yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
