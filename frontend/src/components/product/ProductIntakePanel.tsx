import { type ReactNode } from "react";
import {
  canAdvanceCard,
  isCardComplete,
  type IntakeFieldSources,
  type ProductIntakeState,
} from "../../lib/kgIntakeSchema";
import { ProductIntakeForm } from "./ProductIntakeForm";

export type PlaybookSubTab = "company" | "product" | "market";

const SUB_TABS: { id: PlaybookSubTab; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "product", label: "Product" },
  { id: "market", label: "Market" },
];

const SUB_TAB_CARDS: Record<PlaybookSubTab, "organisation" | "product" | "data_ai"> = {
  company: "organisation",
  product: "product",
  market: "organisation",
};

interface Props {
  intake: ProductIntakeState;
  fieldSources: IntakeFieldSources;
  extractSummary: string[];
  files: File[];
  parsing: boolean;
  canContinue: boolean;
  activeSubTab?: PlaybookSubTab;
  onSubTabChange?: (tab: PlaybookSubTab) => void;
  onIntakeChange: (patch: Partial<ProductIntakeState>) => void;
  onFilesChange: (files: File[]) => void;
  onRunParse: () => Promise<boolean>;
  onSeeLaws: () => void | Promise<void>;
  graph?: ReactNode;
}

export function ProductIntakePanel({
  intake,
  fieldSources,
  extractSummary,
  canContinue,
  activeSubTab = "company",
  onSubTabChange,
  onIntakeChange,
  onSeeLaws,
  graph,
}: Props) {
  const cardId = SUB_TAB_CARDS[activeSubTab];
  const cardComplete = isCardComplete(cardId, intake);
  const canProceed = canAdvanceCard(cardId, intake) && cardComplete;

  function getCardTitle() {
    if (activeSubTab === "company") return "Your organisation";
    if (activeSubTab === "product") return "Product & features";
    if (activeSubTab === "market") return "Markets";
    return "";
  }

  function getCardPrompt() {
    if (activeSubTab === "company") return "Review and confirm who operates the product.";
    if (activeSubTab === "product") return "Review and confirm the product name and what it does.";
    if (activeSubTab === "market") return "Confirm where you offer the product.";
    return "";
  }

  return (
    <div className="ct-intake-workspace">
      {/* Main content */}
      <section className="ct-intake-col ct-intake-col--questions" aria-label="Product facts">
        <div className="ct-intake-subtabs" role="tablist" aria-label="Section">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === tab.id}
              className={`ct-intake-subtab${activeSubTab === tab.id ? " ct-intake-subtab--active" : ""}`}
              onClick={() => onSubTabChange?.(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ct-intake-questions-inner">
          <header className="ct-intake-box-head">
            <h2 className="ct-intake-box-title">{getCardTitle()}</h2>
            <p className="ct-intake-box-prompt">{getCardPrompt()}</p>
          </header>

          {extractSummary.length > 0 ? (
            <p className="ct-intake-extract-summary">
              Extracted from your documents: {extractSummary.join(", ")}. Please confirm below.
            </p>
          ) : null}

          <ProductIntakeForm
            card={cardId}
            intake={intake}
            fieldSources={fieldSources}
            onChange={onIntakeChange}
            filterSection={activeSubTab === "market" ? "markets" : undefined}
          />

          <footer className="ct-intake-sheet-footer">
            <span />
            <button
              type="button"
              className="ct-intake-next-btn"
              disabled={!canContinue && !canProceed}
              onClick={() => void onSeeLaws()}
            >
              Continue to scope analysis →
            </button>
          </footer>
        </div>
      </section>

      {graph ? (
        <section className="ct-intake-col ct-intake-col--graph" aria-label="Knowledge graph">
          <div className="ct-intake-graph-body">{graph}</div>
        </section>
      ) : null}
    </div>
  );
}
