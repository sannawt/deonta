import { useState } from "react";
import { motion } from "framer-motion";
import type { ApplicabilityGate, FactChip } from "@/types/workbench";
import { Badge } from "@/components/ui/badge";
import { gateBadgeVariant } from "./status";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  gate: ApplicabilityGate;
  regulation: string;
  selected: boolean;
  onSelect: (gate: ApplicabilityGate, regulation: string) => void;
}

export function GateCard({ gate, regulation, selected, onSelect }: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={cn(
        "perspective-[1000px] h-[220px] w-full cursor-pointer",
        selected && "ring-2 ring-legal-accent/40 rounded-lg"
      )}
      onClick={() => onSelect(gate, regulation)}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
      >
        <div
          className="absolute inset-0 rounded-lg border border-paper-line bg-paper-surface p-4 shadow-sm"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-ink-dim">{gate.gate}</p>
              <Badge variant={gateBadgeVariant(gate.status)} className="mt-1">
                {gate.status}
              </Badge>
            </div>
            <button
              type="button"
              className="rounded p-1 text-ink-dim hover:bg-paper-muted"
              onClick={(e) => {
                e.stopPropagation();
                setFlipped(true);
              }}
              aria-label="Show legal detail"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-sm font-medium text-ink leading-snug">
            {gate.decisiveQuestion}
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            <ChipGroup label="Known" facts={gate.knownFacts} tone="ok" />
            <ChipGroup label="Missing" facts={gate.missingFacts} tone="warn" />
            <ChipGroup label="Contested" facts={gate.contestedFacts} tone="accent" />
            <ChipGroup label="Defeat" facts={gate.potentialDefeaters} tone="risk" />
          </div>
        </div>

        <div
          className="absolute inset-0 rounded-lg border border-paper-line bg-paper-muted p-4"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-ink-dim">Legal detail — {gate.gate}</p>
            <button
              type="button"
              className="text-xs text-legal-accent hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                setFlipped(false);
              }}
            >
              Back
            </button>
          </div>
          {gate.legalSources[0] && (
            <blockquote className="mt-2 text-xs italic text-ink-mid line-clamp-3">
              {gate.legalSources[0].excerpt}
            </blockquote>
          )}
          <pre className="mt-2 max-h-16 overflow-auto rounded bg-paper-surface p-2 font-mono text-[10px] text-ink-mid">
            {gate.ruleSnippet || "—"}
          </pre>
          {gate.derivedPredicates.length > 0 && (
            <p className="mt-2 font-mono text-[10px] text-legal-accent">
              {gate.derivedPredicates.join(" · ")}
            </p>
          )}
          <button
            type="button"
            className="mt-2 text-[10px] text-ink-dim underline"
            disabled
            title="Future: open in Neo4j Browser"
          >
            Open in graph (placeholder)
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ChipGroup({
  label,
  facts,
  tone,
}: {
  label: string;
  facts: FactChip[];
  tone: "ok" | "warn" | "accent" | "risk";
}) {
  if (facts.length === 0) return null;
  const v = tone === "ok" ? "ok" : tone === "warn" ? "warn" : tone === "risk" ? "risk" : "accent";
  return (
    <>
      {facts.slice(0, 2).map((f) => (
        <Badge key={f.id} variant={v} className="max-w-[140px] truncate">
          {label}: {f.label.slice(0, 28)}
          {f.label.length > 28 ? "…" : ""}
        </Badge>
      ))}
    </>
  );
}
