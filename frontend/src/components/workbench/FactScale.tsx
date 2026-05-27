import type { ReactNode } from "react";
import type { FactScale as FactScaleType } from "@/types/workbench";
import { Check, HelpCircle, ShieldAlert } from "lucide-react";

interface Props {
  regulation: string;
  scale: FactScaleType;
}

export function FactScale({ regulation, scale }: Props) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-dim">
        {regulation} — decisive fact scale
      </p>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-ink-dim">
        <span>Supports scope</span>
        <span className="text-center">Missing / contested</span>
        <span className="text-right">Defeats scope</span>
      </div>
      <div className="grid grid-cols-3 gap-3 rounded-md border border-paper-line bg-paper-muted/50 p-3">
        <Column icon={<Check className="h-3.5 w-3.5 text-legal-ok" />} items={scale.supports} empty="—" />
        <Column icon={<HelpCircle className="h-3.5 w-3.5 text-legal-warn" />} items={scale.missingContested} empty="—" />
        <Column icon={<ShieldAlert className="h-3.5 w-3.5 text-legal-risk" />} items={scale.defeats} empty="—" alignRight />
      </div>
    </div>
  );
}

function Column({
  icon,
  items,
  empty,
  alignRight,
}: {
  icon: ReactNode;
  items: string[];
  empty: string;
  alignRight?: boolean;
}) {
  return (
    <ul className={alignRight ? "text-right" : ""}>
      {items.length === 0 ? (
        <li className="text-ink-dim">{empty}</li>
      ) : (
        items.map((item) => (
          <li key={item} className="mb-1 flex items-start gap-1.5 text-xs text-ink-mid">
            {!alignRight && <span className="mt-0.5 shrink-0">{icon}</span>}
            <span className="font-mono text-[11px] leading-snug">{item}</span>
            {alignRight && <span className="mt-0.5 shrink-0">{icon}</span>}
          </li>
        ))
      )}
    </ul>
  );
}
