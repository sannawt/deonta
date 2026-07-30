import { useState } from "react";
import type { ClarifyingQuestion, ScopeInstrument } from "../../types/chat";
import {
  STATUS_SYMBOL,
  buildLawVerdictDetail,
  filterQuestionsForLaw,
  type ScannedLawItem,
} from "../../lib/applicabilityScan";
import { lawNameFromScannedItem } from "../../lib/lawDisplayName";
import { lawSummaryForCode } from "../../lib/lawSummaries";
import { productScopeAssessment } from "../../lib/scopeProductAssessment";
import { collectLawProvisions } from "../../lib/scopeLegalBasis";
import { ScopeDimensionsTable } from "./ScopeDimensionsTable";
import { LegalInlineText } from "./LegalInlineText";

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"];

interface Props {
  item: ScannedLawItem;
  instrument?: ScopeInstrument;
  openQuestions?: ClarifyingQuestion[];
  defaultOpen?: boolean;
  collapsible?: boolean;
  onFocus?: () => void;
  onCitationSelect?: (provisionId: string) => void;
  onViewLegalBasis?: () => void;
}

export function ApplicabilityLawAccordion({
  item,
  instrument,
  openQuestions = [],
  defaultOpen = false,
  collapsible = true,
  onFocus,
  onCitationSelect,
  onViewLegalBasis,
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

  const lawTitle = lawNameFromScannedItem(item);
  const statusSymbol = STATUS_SYMBOL[item.status] || "△";
  const catalog = lawSummaryForCode(lawCode);
  const overallAssessment = productScopeAssessment(instrument, lawCode);
  const provisionCount = collectLawProvisions(
    instrument,
    instrument?.reg_key || lawCode,
  ).length;

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) onFocus?.();
      return next;
    });
  };

  const isOpen = collapsible ? open : true;

  const detailBody = (
    <div className="ct-scope-law-panel-body ct-scope-detail-view">
      {overallAssessment ? (
        <p className="ct-scope-detail-prose ct-scope-overall-assessment">
          <LegalInlineText text={overallAssessment} regKey={instrument?.reg_key || lawCode} />
        </p>
      ) : null}

      {dimensions.length > 0 ? (
        <section className="ct-scope-detail-dimensions">
          {provisionCount > 0 && onViewLegalBasis ? (
            <div className="ct-scope-legal-basis-actions">
              <button
                type="button"
                className="ct-scope-legal-basis-btn"
                onClick={onViewLegalBasis}
              >
                View legal basis ({provisionCount})
              </button>
            </div>
          ) : null}
          <ScopeDimensionsTable
            dimensions={dimensions}
            regKey={instrument?.reg_key || lawCode}
            onCitationSelect={onCitationSelect}
          />
        </section>
      ) : detail.legalTests.length === 0 ? (
        <p className="ct-scope-prose">No scope dimension breakdown for this instrument yet.</p>
      ) : null}

      {catalog ? (
        <details className="ct-scope-detail-more">
          <summary className="ct-scope-detail-more-summary">About this regulation</summary>
          <p className="ct-scope-detail-prose">
            <LegalInlineText text={catalog.overview} regKey={lawCode} />
          </p>
          {catalog.appliesWhen ? (
            <p className="ct-scope-detail-prose">
              <LegalInlineText text={catalog.appliesWhen} regKey={lawCode} />
            </p>
          ) : null}
          {catalog.keyProvisions?.length ? (
            <ul className="ct-law-scan-provision-list">
              {catalog.keyProvisions.map((prov) => (
                <li key={prov}>
                  <LegalInlineText text={prov} regKey={lawCode} />
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  );

  if (!collapsible) {
    return (
      <div className="ct-scope-law-panel ct-scope-law-panel--detail ct-scope-law-panel--flat">
        {detailBody}
      </div>
    );
  }

  const headContent = (
    <>
      <span className="ct-scope-law-symbol" aria-hidden>
        {statusSymbol}
      </span>
      <span className="ct-scope-law-panel-title-wrap">
        <span className="ct-scope-law-panel-title">
          <strong>{lawTitle}</strong>
        </span>
      </span>
      <span className="ct-scope-law-chevron" aria-hidden>
        {open ? "▾" : "▸"}
      </span>
    </>
  );

  return (
    <div className={`ct-scope-law-panel ct-scope-law-${item.status}${isOpen ? " open" : ""}`}>
      <button type="button" className="ct-scope-law-panel-head" onClick={toggle}>
        {headContent}
      </button>
      {isOpen ? detailBody : null}
    </div>
  );
}
