import { useState } from "react";
import {
  AI_FEATURE_OPTIONS,
  customMarketsFrom,
  DATA_FLOW_OPTIONS,
  fieldSourceLabel,
  formatMarketLabel,
  type IntakeCardId,
  type IntakeFieldSources,
  MARKET_OPTIONS,
  normalizeCustomMarket,
  PRODUCT_FEATURE_OPTIONS,
  type ProductIntakeState,
  type TriState,
} from "../../lib/kgIntakeSchema";

interface Props {
  card: IntakeCardId;
  intake: ProductIntakeState;
  fieldSources?: IntakeFieldSources;
  onChange: (patch: Partial<ProductIntakeState>) => void;
  /** Optional: only show a specific section within the card */
  filterSection?: "markets";
}

function FieldLabel({
  children,
  required,
  htmlFor,
  source,
}: {
  children: string;
  required?: boolean;
  htmlFor?: string;
  source?: string;
}) {
  return (
    <div className="ct-intake-label-row">
      <label className="ct-intake-label" htmlFor={htmlFor}>
        {children}
        {required ? <span className="ct-intake-required">*</span> : null}
      </label>
      {source ? <span className="ct-intake-source-chip">{fieldSourceLabel(source)}</span> : null}
    </div>
  );
}

function YesNoBoxes({
  label,
  value,
  source,
  onChange,
}: {
  label: string;
  value: TriState;
  source?: string;
  onChange: (v: TriState) => void;
}) {
  return (
    <div className="ct-intake-field ct-intake-field--span-3">
      <FieldLabel source={source}>{label}</FieldLabel>
      <div className="ct-intake-yesno-row">
        <label className="ct-intake-check-item">
          <input
            type="checkbox"
            checked={value === "yes"}
            onChange={() => onChange(value === "yes" ? "unknown" : "yes")}
          />
          <span>Yes</span>
        </label>
        <label className="ct-intake-check-item">
          <input
            type="checkbox"
            checked={value === "no"}
            onChange={() => onChange(value === "no" ? "unknown" : "no")}
          />
          <span>No</span>
        </label>
      </div>
    </div>
  );
}

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Toggle a checkbox in a list where "none" is exclusive with other options. */
function toggleExclusiveNone(list: string[], id: string): string[] {
  if (id === "none") {
    return list.includes("none") ? [] : ["none"];
  }
  const withoutNone = list.filter((x) => x !== "none");
  return withoutNone.includes(id)
    ? withoutNone.filter((x) => x !== id)
    : [...withoutNone, id];
}

export function ProductIntakeForm({ card, intake, fieldSources = {}, onChange, filterSection }: Props) {
  const src = (key: keyof ProductIntakeState) => fieldSources[key];
  const customMarkets = customMarketsFrom(intake.markets);
  const [otherOpen, setOtherOpen] = useState(customMarkets.length > 0);
  const [otherInput, setOtherInput] = useState("");

  function addCustomMarket() {
    const value = normalizeCustomMarket(otherInput);
    if (!value || intake.markets.includes(value)) return;
    onChange({ markets: [...intake.markets, value] });
    setOtherInput("");
    setOtherOpen(true);
  }

  if (card === "organisation") {
    const showOtherInput = otherOpen || customMarkets.length > 0;
    const showOrgFields = filterSection !== "markets";
    const showMarketFields = !filterSection || filterSection === "markets";
    return (
      <div className="ct-intake-form-grid">
        {showOrgFields && (
        <div className="ct-intake-field ct-intake-field--span-3">
          <FieldLabel htmlFor="organisation-name" source={src("organisationName")}>
            Organisation name
          </FieldLabel>
          <input
            id="organisation-name"
            type="text"
            className="ct-intake-input"
            value={intake.organisationName}
            onChange={(e) => onChange({ organisationName: e.target.value })}
            placeholder="Company or team name"
          />
        </div>
        )}
        {showMarketFields && <div className="ct-intake-field ct-intake-field--span-3">
          <FieldLabel source={src("markets")}>Where you operate or sell</FieldLabel>
          <div className="ct-intake-check-grid ct-intake-check-grid--5">
            {MARKET_OPTIONS.map((m) => (
              <label key={m.id} className="ct-intake-check-item">
                <input
                  type="checkbox"
                  checked={intake.markets.includes(m.id)}
                  onChange={() => onChange({ markets: toggleInList(intake.markets, m.id) })}
                />
                <span>{m.label}</span>
              </label>
            ))}
            <label className="ct-intake-check-item">
              <input
                type="checkbox"
                checked={showOtherInput}
                onChange={(e) => {
                  if (e.target.checked) {
                    setOtherOpen(true);
                  } else {
                    setOtherOpen(false);
                    setOtherInput("");
                    onChange({ markets: intake.markets.filter((m) => MARKET_OPTIONS.some((o) => o.id === m)) });
                  }
                }}
              />
              <span>Other</span>
            </label>
          </div>
          {showOtherInput ? (
            <div className="ct-intake-market-other">
              <div className="ct-intake-market-other-row">
                <input
                  type="text"
                  className="ct-intake-input"
                  value={otherInput}
                  onChange={(e) => setOtherInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomMarket();
                    }
                  }}
                  placeholder="e.g. Canada, Japan, Australia"
                />
                <button
                  type="button"
                  className="ct-intake-market-add-btn"
                  disabled={!normalizeCustomMarket(otherInput)}
                  onClick={addCustomMarket}
                >
                  Add
                </button>
              </div>
              {customMarkets.length > 0 ? (
                <ul className="ct-intake-market-tags">
                  {customMarkets.map((m) => (
                    <li key={m}>
                      <span>{formatMarketLabel(m)}</span>
                      <button
                        type="button"
                        className="ct-intake-market-tag-remove"
                        aria-label={`Remove ${formatMarketLabel(m)}`}
                        onClick={() => onChange({ markets: intake.markets.filter((x) => x !== m) })}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>}
        {showMarketFields && <YesNoBoxes
          label="Company established in the EU or EEA"
          value={intake.establishedInEu}
          source={src("establishedInEu")}
          onChange={(v) => onChange({ establishedInEu: v })}
        />}
        {showMarketFields && <YesNoBoxes
          label="Offer the product to people in the EU or EEA"
          value={intake.sellsToEu}
          source={src("sellsToEu")}
          onChange={(v) => onChange({ sellsToEu: v })}
        />}
      </div>
    );
  }

  if (card === "product") {
    return (
      <div className="ct-intake-form-grid">
        <div className="ct-intake-field ct-intake-field--span-3">
          <FieldLabel htmlFor="product-name" required source={src("productName")}>
            Product or service name
          </FieldLabel>
          <input
            id="product-name"
            type="text"
            className="ct-intake-input"
            value={intake.productName}
            onChange={(e) => onChange({ productName: e.target.value })}
            placeholder="e.g. CVSCAN"
          />
        </div>
        <div className="ct-intake-field ct-intake-field--span-3">
          <FieldLabel source={src("productFeatures")}>Features — what does it do?</FieldLabel>
          <div className="ct-intake-check-grid ct-intake-check-grid--features">
            {PRODUCT_FEATURE_OPTIONS.map((f) => (
              <label key={f.id} className="ct-intake-check-item">
                <input
                  type="checkbox"
                  checked={(intake.productFeatures ?? []).includes(f.id)}
                  onChange={() =>
                    onChange({
                      productFeatures: toggleInList(intake.productFeatures ?? [], f.id),
                    })
                  }
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="ct-intake-field ct-intake-field--span-3">
          <FieldLabel htmlFor="product-summary" source={src("productSummary")}>
            Other details
          </FieldLabel>
          <textarea
            id="product-summary"
            className="ct-intake-input ct-intake-input--textarea"
            value={intake.productSummary}
            onChange={(e) => onChange({ productSummary: e.target.value })}
            placeholder="Optional — anything else about what it does"
            rows={2}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ct-intake-form-grid ct-intake-guided">
      <div className="ct-intake-field ct-intake-field--span-3">
        <FieldLabel source={src("dataFlows")}>Data flows</FieldLabel>
        <div className="ct-intake-check-grid ct-intake-check-grid--features">
          {DATA_FLOW_OPTIONS.map((f) => (
            <label key={f.id} className="ct-intake-check-item">
              <input
                type="checkbox"
                checked={(intake.dataFlows ?? []).includes(f.id)}
                onChange={() =>
                  onChange({ dataFlows: toggleExclusiveNone(intake.dataFlows ?? [], f.id) })
                }
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="ct-intake-field ct-intake-field--span-3">
        <FieldLabel htmlFor="data-flow" source={src("dataFlowDescription")}>
          Other data details
        </FieldLabel>
        <textarea
          id="data-flow"
          className="ct-intake-input ct-intake-input--textarea"
          value={intake.dataFlowDescription}
          onChange={(e) => onChange({ dataFlowDescription: e.target.value })}
          placeholder="Optional — anything else about what you collect or share"
          rows={2}
        />
      </div>
      <div className="ct-intake-field ct-intake-field--span-3">
        <FieldLabel source={src("aiFeatures")}>AI use</FieldLabel>
        <div className="ct-intake-check-grid ct-intake-check-grid--features">
          {AI_FEATURE_OPTIONS.map((f) => (
            <label key={f.id} className="ct-intake-check-item">
              <input
                type="checkbox"
                checked={(intake.aiFeatures ?? []).includes(f.id)}
                onChange={() =>
                  onChange({ aiFeatures: toggleExclusiveNone(intake.aiFeatures ?? [], f.id) })
                }
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="ct-intake-field ct-intake-field--span-3">
        <FieldLabel htmlFor="ai-usage" source={src("aiUsageDescription")}>
          Other AI details
        </FieldLabel>
        <textarea
          id="ai-usage"
          className="ct-intake-input ct-intake-input--textarea"
          value={intake.aiUsageDescription}
          onChange={(e) => onChange({ aiUsageDescription: e.target.value })}
          placeholder="Optional — anything else about how AI is used"
          rows={2}
        />
      </div>
    </div>
  );
}
