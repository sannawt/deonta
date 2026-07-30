import type { MissingPredicateHint } from "../../lib/kgIntakeSchema";
import { INTAKE_CARDS } from "../../lib/kgIntakeSchema";

interface Props {
  items: MissingPredicateHint[];
  onJumpToCard?: (cardIndex: number) => void;
  compact?: boolean;
}

const CARD_INDEX: Record<string, number> = {
  organisation: 1,
  product: 2,
  data_ai: 3,
};

export function MissingPredicatesPanel({ items, onJumpToCard, compact = false }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      className={`ct-missing-predicates${compact ? " ct-missing-predicates--compact" : ""}`}
      aria-labelledby="missing-predicates-title"
    >
      <h3 className="ct-missing-predicates-title" id="missing-predicates-title">
        Facts needed for tighter scoping
      </h3>
      <p className="ct-missing-predicates-intro">
        These details would sharpen framework mapping. Add them in product facts intake.
      </p>
      <ul className="ct-missing-predicates-list">
        {items.map((item) => {
          const cardIdx = item.cardId ? CARD_INDEX[item.cardId] : undefined;
          const cardLabel = item.cardId
            ? INTAKE_CARDS.find((c) => c.id === item.cardId)?.progressLabel
            : undefined;
          return (
            <li key={`${item.predicate}-${item.description}`} className="ct-missing-predicates-item">
              <span className="ct-missing-predicates-text">{item.description}</span>
              {cardLabel && onJumpToCard && cardIdx !== undefined ? (
                <button
                  type="button"
                  className="ct-missing-predicates-link"
                  onClick={() => onJumpToCard(cardIdx)}
                >
                  Answer in {cardLabel}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
