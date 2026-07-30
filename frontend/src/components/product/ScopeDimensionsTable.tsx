import type { ClarifyingQuestion, ScopeDimension } from "../../types/chat";
import { ScopeDimensionCard } from "./ScopeDimensionCard";

const DIM_ORDER = ["temporal", "territorial", "material", "exclusions"];

interface Props {
  dimensions: ScopeDimension[];
  regKey?: string;
  openQuestions?: ClarifyingQuestion[];
  onCitationSelect?: (provisionId: string) => void;
}

export function ScopeDimensionsTable({
  dimensions,
  regKey,
  openQuestions = [],
  onCitationSelect,
}: Props) {
  const sorted = [...dimensions].sort((a, b) => {
    const ai = DIM_ORDER.indexOf(a.id);
    const bi = DIM_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="ct-scope-dim-table ct-scope-dim-table--compact">
      {sorted.map((dim) => (
        <ScopeDimensionCard
          key={dim.id}
          dim={dim}
          regKey={regKey}
          openQuestions={openQuestions}
          compact
          onCitationSelect={onCitationSelect}
        />
      ))}
    </div>
  );
}
