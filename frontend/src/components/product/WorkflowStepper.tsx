interface StepItem {
  id: string;
  label: string;
  title?: string;
  enabled: boolean;
  current: boolean;
  onClick?: () => void;
}

interface Props {
  steps: StepItem[];
}

const WORKFLOW_STEPS = ["step1", "step2", "step3"];

export function WorkflowStepper({ steps }: Props) {
  const start = steps.find((s) => s.id === "start");
  const numbered = steps.filter((s) => WORKFLOW_STEPS.includes(s.id));
  const currentIdx = numbered.findIndex((s) => s.current);
  const current = currentIdx >= 0 ? numbered[currentIdx] : null;

  return (
    <nav className="ct-workflow-stepper ct-workflow-stepper--minimal" aria-label="Workflow progress">
      {start?.onClick ? (
        <button type="button" className="ct-workflow-stepper-home" onClick={start.onClick}>
          Home
        </button>
      ) : (
        <span />
      )}

      {current ? (
        <p className="ct-workflow-stepper-status">
          <span className="ct-workflow-stepper-status-title">
            {current.title || current.label}
          </span>
          <span className="ct-workflow-stepper-status-meta">
            Step {currentIdx + 1} of {numbered.length}
          </span>
        </p>
      ) : null}
    </nav>
  );
}
