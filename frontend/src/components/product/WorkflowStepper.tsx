import { useEffect, useRef, useState } from "react";
import { defaultAssessmentTitle } from "../../lib/assessmentRef";

export interface TopTab {
  id: string;
  label: string;
  enabled: boolean;
  current: boolean;
  subTabs: SubTab[];
  onClick?: () => void;
}

export interface SubTab {
  id: string;
  label: string;
  enabled: boolean;
  current: boolean;
  onClick?: () => void;
}

interface Props {
  topTabs: TopTab[];
  assessmentId?: string;
  assessmentTitle?: string;
  onAssessmentTitleChange?: (title: string) => void;
}

function EditIcon() {
  return (
    <svg
      className="ct-workflow-assessment-edit"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function AssessmentTitle({
  assessmentId,
  title,
  onTitleChange,
}: {
  assessmentId: string;
  title: string;
  onTitleChange: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayTitle = title.trim() || defaultAssessmentTitle(assessmentId);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = draft.trim() || defaultAssessmentTitle(assessmentId);
    setDraft(next);
    onTitleChange(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="ct-workflow-assessment-input"
        value={draft}
        aria-label="Assessment name"
        placeholder="Name this assessment"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(title); setEditing(false); }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="ct-workflow-assessment-name"
      onClick={() => setEditing(true)}
      title="Rename assessment"
    >
      <span className="ct-workflow-assessment-name-text">{displayTitle}</span>
      <EditIcon />
    </button>
  );
}

function TabButton({
  label,
  current,
  enabled,
  onClick,
  level,
}: {
  label: string;
  current: boolean;
  enabled: boolean;
  onClick?: () => void;
  level: "top" | "sub";
}) {
  const cls = [
    level === "top" ? "ct-workflow-tab-top" : "ct-workflow-tab-sub",
    current ? "ct-workflow-tab--current" : "",
    !enabled ? "ct-workflow-tab--disabled" : "",
    enabled && !current ? "ct-workflow-tab--enabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (enabled && onClick && !current) {
    return (
      <button type="button" role="tab" className={cls} aria-selected={false} onClick={onClick}>
        {label}
      </button>
    );
  }
  return (
    <span
      role="tab"
      className={cls}
      aria-selected={current}
      aria-current={current ? "step" : undefined}
      aria-disabled={!enabled || undefined}
    >
      {label}
    </span>
  );
}

export function WorkflowStepper({
  topTabs,
  assessmentId,
  assessmentTitle,
  onAssessmentTitleChange,
}: Props) {
  const showTitle = Boolean(assessmentId && onAssessmentTitleChange);
  const _currentTop = topTabs.find((t) => t.current) ?? topTabs[0];
  void _currentTop; // sub-tabs rendered inside content panels, not here

  return (
    <nav className="ct-workflow-stepper" aria-label="Assessment workflow">
      <div className="ct-workflow-stepper-row">
        <div className="ct-workflow-stepper-tabs" role="tablist" aria-label="Workflow sections">
          {topTabs.map((tab) => (
            <TabButton
              key={tab.id}
              label={tab.label}
              current={tab.current}
              enabled={tab.enabled}
              onClick={tab.onClick}
              level="top"
            />
          ))}
        </div>

        {showTitle ? (
          <div className="ct-workflow-assessment">
            <AssessmentTitle
              assessmentId={assessmentId!}
              title={assessmentTitle ?? ""}
              onTitleChange={onAssessmentTitleChange!}
            />
          </div>
        ) : null}
      </div>
    </nav>
  );
}
