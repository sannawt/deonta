import { useEffect, useRef, useState } from "react";
import { defaultAssessmentTitle, formatAssessmentRef } from "../../lib/assessmentRef";

interface Props {
  assessmentId: string;
  title: string;
  onTitleChange: (title: string) => void;
  /** When true, show that the title was auto-suggested from intake facts. */
  suggested?: boolean;
  compact?: boolean;
}

function EditIcon() {
  return (
    <svg
      className="ct-assessment-nav-edit-icon"
      width="14"
      height="14"
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

export function AssessmentNavBar({
  assessmentId,
  title,
  onTitleChange,
  suggested = false,
  compact = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = formatAssessmentRef(assessmentId);
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

  return (
    <header
      className={`ct-assessment-nav${compact ? " ct-assessment-nav--compact" : ""}`}
      aria-label="Assessment"
    >
      <div className="ct-assessment-nav-title-block">
        {editing ? (
          <input
            ref={inputRef}
            className="ct-assessment-nav-title-input"
            value={draft}
            aria-label="Assessment name"
            placeholder="Name this assessment"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="ct-assessment-nav-title"
            onClick={() => setEditing(true)}
            title="Rename assessment"
          >
            <span className="ct-assessment-nav-title-text">{displayTitle}</span>
            <EditIcon />
          </button>
        )}
        {suggested && !editing ? (
          <p className="ct-assessment-nav-suggested">Suggested from intake — click to rename</p>
        ) : null}
      </div>
      <span className="ct-assessment-nav-ref" title="Assessment reference">
        {ref}
      </span>
    </header>
  );
}
