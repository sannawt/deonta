import { useState } from "react";
import type { ClarifyingQuestion, ScopeInstrument } from "../../types/chat";
import {
  STATUS_SYMBOL,
  buildLawVerdictDetail,
  filterQuestionsForLaw,
  verdictBadgeClass,
  type ScannedLawItem,
} from "../../lib/applicabilityScan";
import { humanizeMissingQuestion } from "../../lib/plainLanguage";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";
import { ScopeDimensionCard } from "./ScopeDimensionCard";
import { LegalInlineText } from "./LegalInlineText";

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"];

interface Props {
  item: ScannedLawItem;
  instrument?: ScopeInstrument;
  openQuestions?: ClarifyingQuestion[];
  defaultOpen?: boolean;
  collapsible?: boolean;
  onFocus?: () => void;
}

export function ApplicabilityLawAccordion({
  item,
  instrument,
  openQuestions = [],
  defaultOpen = false,
  collapsible = true,
  onFocus,
}: Props) {
  const [open, setOpen] = useState(defaultOpen || !collapsible);
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

  const lawTitle = lawNameFromScannedItem(item);
  const subtitle =
    instrument?.label?.trim() &&
    instrument.label.trim().toLowerCase() !== lawTitle.toLowerCase()
      ? instrument.label.trim()
      : item.scanRow?.number?.trim() || "";

  const statusSymbol = STATUS_SYMBOL[item.status] || "△";
  const badgeClass = verdictBadgeClass(detail.verdict);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) onFocus?.();
      return next;
    });
  };

  const isOpen = collapsible ? open : true;

  const headContent = (
    <>
      <span className="ct-scope-law-symbol" aria-hidden>
        {statusSymbol}
      </span>
      <span className="ct-scope-law-panel-title-wrap">
        <span className="ct-scope-law-panel-title">
          <strong>{lawTitle}</strong>
        </span>
        <span className={`ct-scope-verdict-badge ${badgeClass}`}>{detail.verdict}</span>
      </span>
      {collapsible ? (
        <span className="ct-scope-law-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      ) : null}
    </>
  );

  const detailBody = (
    <div className="ct-scope-law-panel-body ct-scope-detail-view">
      <header className="ct-scope-detail-hero">
        <div className="ct-scope-detail-hero-text">
          <h2 className="ct-scope-detail-title">{lawTitle}</h2>
          {subtitle ? <p className="ct-scope-detail-subtitle">{subtitle}</p> : null}
        </div>
        <span className={`ct-scope-detail-verdict ${badgeClass}`}>{detail.verdict}</span>
      </header>

      {detail.summary ? (
        <div className="ct-scope-detail-summary">
          <p>
            <LegalInlineText
              text={detail.summary}
              regKey={instrument?.reg_key}
            />
          </p>
        </div>
      ) : null}

      {instrumentMissing.length > 0 ? (
        <aside className="ct-scope-detail-open-questions">
          <h3 className="ct-scope-detail-section-title">Open questions</h3>
          <ul>
            {instrumentMissing.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </aside>
      ) : null}

      {dimensions.length > 0 ? (
        <section className="ct-scope-detail-dimensions">
          <div className="ct-scope-dim-table">
            {dimensions.map((dim) => (
              <ScopeDimensionCard
                key={dim.id}
                dim={dim}
                regKey={instrument?.reg_key}
                openQuestions={lawQuestions}
              />
            ))}
          </div>
        </section>
      ) : detail.legalTests.length === 0 ? (
        <p className="ct-scope-prose">No scope dimension breakdown for this instrument yet.</p>
      ) : null}
    </div>
  );

  return (
    <div
      className={`ct-scope-law-panel ct-scope-law-${item.status}${isOpen ? " open" : ""}${collapsible ? "" : " ct-scope-law-panel--detail"}`}
    >
      {collapsible ? (
        <button type="button" className="ct-scope-law-panel-head" onClick={toggle}>
          {headContent}
        </button>
      ) : (
        <div className="ct-scope-law-panel-head ct-scope-law-panel-head--static ct-scope-law-panel-head--hidden">
          {headContent}
        </div>
      )}

      {isOpen ? detailBody : null}
    </div>
  );
}
