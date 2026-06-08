import { useMemo, useState } from "react";
import type { ClarifyingQuestion, ScopeInstrument } from "../../types/chat";
import {
  STATUS_SYMBOL,
  buildLawVerdictDetail,
  filterQuestionsForLaw,
  verdictBadgeClass,
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

  const instrumentTitle = instrument?.full_name?.trim();
  const lawTitle =
    instrumentTitle ||
    (item.fullLabel && item.fullLabel !== item.listLabel
      ? `${item.listLabel} — ${item.fullLabel}`
      : item.listLabel);

  const statusSymbol = STATUS_SYMBOL[item.status] || "△";
  const badgeClass = verdictBadgeClass(detail.verdict);

  const legalTestLine = useMemo(() => {
    if (!detail.legalTests.length) return null;
    return detail.legalTests
      .map((t) => (
        <span key={t.label}>
          <strong>{t.label}</strong> {t.answer}
        </span>
      ));
  }, [detail.legalTests]);

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
        <span className="ct-scope-law-symbol" aria-hidden>
          {statusSymbol}
        </span>
        <span className="ct-scope-law-panel-title-wrap">
          <span className="ct-scope-law-panel-title">
            <strong>{lawTitle}</strong>
          </span>
          <span className={`ct-scope-verdict-badge ${badgeClass}`}>{detail.verdict}</span>
        </span>
        <span className="ct-scope-law-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="ct-scope-law-panel-body">
          {detail.summary ? (
            <p className="ct-scope-law-summary">{detail.summary}</p>
          ) : null}

          <div className="ct-scope-law-meta">
            <p className="ct-scope-law-meta-row">
              <span className="ct-scope-law-meta-label">Confidence</span>
              <span>{detail.confidence}</span>
            </p>
            {legalTestLine ? (
              <p className="ct-scope-law-meta-row ct-scope-law-meta-row--test">
                {legalTestLine}
              </p>
            ) : null}
          </div>

          {instrumentMissing.length > 0 ? (
            <div className="ct-scope-law-open-questions">
              <p className="ct-scope-law-meta-label">Open questions</p>
              <ul>
                {instrumentMissing.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}

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
