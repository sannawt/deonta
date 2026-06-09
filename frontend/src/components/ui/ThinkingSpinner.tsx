import { brandIcons } from "../../lib/brandIcons";

interface Props {
  active?: boolean;
  label?: string;
  size?: number;
}

/** Scale icon — spins while the system is processing. */
export function ThinkingSpinner({ active = true, label = "Thinking…", size = 56 }: Props) {
  if (!active) return null;

  return (
    <div className="ct-thinking" role="status" aria-live="polite" aria-label={label}>
      <span className="ct-hourglass-spin-wrap" aria-hidden>
        <img
          src={brandIcons.hourglass}
          alt=""
          className="ct-thinking-icon"
          width={size}
          height={size}
          draggable={false}
        />
      </span>
      {label ? <span className="ct-thinking-label">{label}</span> : null}
    </div>
  );
}
