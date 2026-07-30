interface Props {
  compact?: boolean;
}

export function AssessmentDisclaimer({ compact = false }: Props) {
  return (
    <p
      className={`ct-assessment-disclaimer${compact ? " ct-assessment-disclaimer--compact" : ""}`}
      role="note"
    >
      Structured scoping aid for internal review. Not legal advice.
    </p>
  );
}
