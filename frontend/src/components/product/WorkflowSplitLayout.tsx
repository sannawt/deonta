import type { ReactNode } from "react";

interface Props {
  stepLabel: string;
  title?: string;
  intro: string;
  actions: ReactNode;
  results: ReactNode;
  actionsTitle?: string;
  resultsTitle?: string;
  actionsAriaLabel?: string;
  resultsAriaLabel?: string;
  splitClassName?: string;
  detail?: ReactNode;
  detailAriaLabel?: string;
}

export function WorkflowSplitLayout({
  stepLabel,
  title,
  intro,
  actions,
  results,
  actionsTitle = "Actions",
  resultsTitle = "Results",
  actionsAriaLabel = "Actions",
  resultsAriaLabel = "Results",
  splitClassName,
  detail,
  detailAriaLabel = "Legal basis",
}: Props) {
  const showHeader = Boolean(stepLabel || title || intro);
  const splitClasses = [
    "ct-workflow-split",
    splitClassName,
    detail ? "ct-workflow-split--with-detail" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ct-workflow-step">
      {showHeader ? (
        <header className="ct-workflow-step-header">
          {stepLabel ? <p className="ct-workflow-step-eyebrow">{stepLabel}</p> : null}
          {title ? <h2 className="ct-workflow-step-title">{title}</h2> : null}
          {intro ? <p className="ct-workflow-step-intro">{intro}</p> : null}
        </header>
      ) : null}

      <div className={splitClasses}>
        <aside className="ct-workflow-pane ct-workflow-pane--actions" aria-label={actionsAriaLabel}>
          {actionsTitle ? (
            <header className="ct-workflow-pane-header">
              <span className="ct-workflow-pane-header-label">{actionsTitle}</span>
            </header>
          ) : null}
          <div className="ct-workflow-pane-body">{actions}</div>
        </aside>
        <section className="ct-workflow-pane ct-workflow-pane--results" aria-label={resultsAriaLabel}>
          <header className="ct-workflow-pane-header">
            <span className="ct-workflow-pane-header-label">{resultsTitle}</span>
          </header>
          <div className="ct-workflow-pane-body ct-workflow-pane-body--results">{results}</div>
        </section>
        {detail ? (
          <section
            className="ct-workflow-pane ct-workflow-pane--legal-basis"
            aria-label={detailAriaLabel}
          >
            <div className="ct-workflow-pane-body ct-workflow-pane-body--legal-basis">{detail}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
