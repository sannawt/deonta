import { ThinkingSpinner } from "./ThinkingSpinner";

interface Props {
  show: boolean;
  label?: string;
}

/** Centered thinking indicator for full-step loads. */
export function ThinkingOverlay({ show, label }: Props) {
  if (!show) return null;

  return (
    <div className="ct-thinking-overlay">
      <ThinkingSpinner active label={label} size={48} />
    </div>
  );
}
