interface StepItem {
  id: string;
  label: string;
  enabled: boolean;
  current: boolean;
  onClick?: () => void;
}

interface Props {
  steps: StepItem[];
}

export function WorkflowStepper({ steps }: Props) {
  return (
    <nav className="ct-workflow-stepper" aria-label="Workflow progress">
      <ol className="ct-workflow-stepper-list">
        {steps.map((step, index) => (
          <li key={step.id} className="ct-workflow-stepper-item">
            {index > 0 && (
              <span className="ct-workflow-stepper-sep" aria-hidden>
                —
              </span>
            )}
            {step.enabled && step.onClick ? (
              <button
                type="button"
                className={`ct-workflow-stepper-link ${step.current ? "current" : ""}`}
                onClick={step.onClick}
                aria-current={step.current ? "step" : undefined}
              >
                {step.label}
              </button>
            ) : (
              <span
                className={`ct-workflow-stepper-link disabled ${step.current ? "current" : ""}`}
                aria-disabled="true"
              >
                {step.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
