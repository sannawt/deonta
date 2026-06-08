import type { ReactNode } from "react";
import type { brandIcons } from "../../lib/brandIcons";
import { PixelIcon } from "../ui/PixelIcon";

type IconName = keyof typeof brandIcons;

interface Props {
  stepLabel: string;
  intro: string;
  icon?: IconName;
  actions: ReactNode;
  results: ReactNode;
  actionsAriaLabel?: string;
  resultsAriaLabel?: string;
}

export function WorkflowSplitLayout({
  stepLabel,
  intro,
  icon,
  actions,
  results,
  actionsAriaLabel = "Actions",
  resultsAriaLabel = "Results",
}: Props) {
  return (
    <div className="ct-workflow-step">
      <header
        className={`ct-scanner-head${icon ? "" : " ct-scanner-head--text-only"}`}
      >
        {icon ? (
          <PixelIcon name={icon} size={96} className="ct-scanner-head-icon" />
        ) : null}
        <div className="ct-scanner-head-text">
          <p className="ct-scanner-step">{stepLabel}</p>
          <p className="ct-scanner-intro">{intro}</p>
        </div>
      </header>

      <div className="ct-workflow-split">
        <aside className="ct-workflow-pane ct-workflow-pane--actions" aria-label={actionsAriaLabel}>
          {actions}
        </aside>
        <section className="ct-workflow-pane ct-workflow-pane--results" aria-label={resultsAriaLabel}>
          {results}
        </section>
      </div>
    </div>
  );
}
