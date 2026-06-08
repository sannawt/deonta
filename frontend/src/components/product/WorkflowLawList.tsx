interface LawEntry {
  code: string;
  name: string;
}

interface Props {
  title?: string;
  hint?: string;
  laws: LawEntry[];
  focusedCode: string | null;
  onSelect: (code: string) => void;
  emptyMessage?: string;
  minimal?: boolean;
}

export function WorkflowLawList({
  title = "Laws",
  hint,
  laws,
  focusedCode,
  onSelect,
  emptyMessage = "No laws available.",
  minimal = false,
}: Props) {
  if (!laws.length) {
    return (
      <nav className="ct-law-scan-sidebar" aria-label={title}>
        {!minimal ? (
          <header className="ct-workflow-actions-head">
            <h3 className="ct-workflow-actions-title">{title}</h3>
          </header>
        ) : null}
        <p className="ct-workflow-actions-empty">{emptyMessage}</p>
      </nav>
    );
  }

  return (
    <nav className="ct-law-scan-sidebar" aria-label={title}>
      {!minimal ? (
        <header className="ct-workflow-actions-head">
          <h3 className="ct-workflow-actions-title">{title}</h3>
          {hint ? <p className="ct-workflow-actions-hint">{hint}</p> : null}
        </header>
      ) : null}
      <ul className="ct-law-scan-sidebar-list">
        {laws.map((law) => {
          const active = law.code === focusedCode;
          return (
            <li key={law.code}>
              <button
                type="button"
                className={`ct-law-scan-sidebar-item ct-law-scan-sidebar-btn${active ? " ct-law-scan-sidebar-item--active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(law.code)}
              >
                <span className="ct-law-scan-sidebar-label">{law.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
