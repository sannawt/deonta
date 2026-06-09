import { useState } from "react";
import {
  customMarketsFrom,
  fieldSourceLabel,
  formatMarketLabel,
  type IntakeCardId,
  type IntakeFieldSources,
  MARKET_OPTIONS,
  normalizeCustomMarket,
  type ProductIntakeState,
  type TriState,
} from "../../lib/kgIntakeSchema";

interface Props {
  card: IntakeCardId;
  intake: ProductIntakeState;
  fieldSources?: IntakeFieldSources;
  onChange: (patch: Partial<ProductIntakeState>) => void;
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

export function ProductIntakeForm({ card, intake, fieldSources = {}, onChange }: Props) {
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
    return (
      <div className="ct-intake-form-grid">
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
        <div className="ct-intake-field ct-intake-field--span-3">
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
        </div>
        <YesNoBoxes
          label="Company established in the EU or EEA"
          value={intake.establishedInEu}
          source={src("establishedInEu")}
          onChange={(v) => onChange({ establishedInEu: v })}
        />
        <YesNoBoxes
          label="Offer the product to people in the EU or EEA"
          value={intake.sellsToEu}
          source={src("sellsToEu")}
          onChange={(v) => onChange({ sellsToEu: v })}
        />
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
          <FieldLabel htmlFor="product-summary" source={src("productSummary")}>
            Features — what does it do?
          </FieldLabel>
          <textarea
            id="product-summary"
            className="ct-intake-input ct-intake-input--textarea"
            value={intake.productSummary}
            onChange={(e) => onChange({ productSummary: e.target.value })}
            placeholder="Main capabilities, who uses it, how it works"
            rows={4}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ct-intake-form-grid ct-intake-guided">
      <div className="ct-intake-field ct-intake-field--span-3">
        <FieldLabel htmlFor="data-flow" source={src("dataFlowDescription")}>
          What kind of data flows through your product?
        </FieldLabel>
        <p className="ct-intake-guided-hint">
          Describe what you collect, store, or share — e.g. customer emails for sign-up, employee
          records in HR, applicant CVs, usage logs. Say if you do not handle personal data.
        </p>
        <textarea
          id="data-flow"
          className="ct-intake-input ct-intake-input--textarea"
          value={intake.dataFlowDescription}
          onChange={(e) => onChange({ dataFlowDescription: e.target.value })}
          placeholder="e.g. We store customer names, emails, and payment details for subscriptions. Employees upload internal documents."
          rows={4}
        />
      </div>
      <div className="ct-intake-field ct-intake-field--span-3">
        <FieldLabel htmlFor="ai-usage" source={src("aiUsageDescription")}>
          Is AI used? Where and how?
        </FieldLabel>
        <p className="ct-intake-guided-hint">
          Describe any machine learning, automation, or generative AI — what it does and where in
          the product. Say clearly if you do not use AI.
        </p>
        <textarea
          id="ai-usage"
          className="ct-intake-input ct-intake-input--textarea"
          value={intake.aiUsageDescription}
          onChange={(e) => onChange({ aiUsageDescription: e.target.value })}
          placeholder="e.g. An ML model ranks job applicants from uploaded CVs. A chatbot answers support questions using an LLM."
          rows={4}
        />
      </div>
    </div>
  );
}
