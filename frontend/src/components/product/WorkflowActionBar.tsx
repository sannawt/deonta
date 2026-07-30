interface SecondaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface Props {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  secondary?: SecondaryAction;
}

/** Primary workflow actions — sits below the stepper. */
export function WorkflowActionBar({ label, disabled, busy, onClick, secondary }: Props) {
  return (
    <div className="ct-workflow-action-bar">
      {secondary ? (
        <button
          type="button"
          className="ct-workflow-action-bar-btn ct-workflow-action-bar-btn--secondary"
          disabled={secondary.disabled || busy}
          onClick={secondary.onClick}
        >
          {secondary.label}
        </button>
      ) : null}
      <button
        type="button"
        className="ct-workflow-action-bar-btn"
        disabled={disabled || busy}
        onClick={onClick}
      >
        {busy ? "Please wait…" : label}
      </button>
    </div>
  );
}
