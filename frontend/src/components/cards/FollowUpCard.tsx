interface Props {
  onSend: (text: string) => void;
}

const FOLLOW_UPS = [
  "What evidence do I need to document for GDPR compliance?",
  "Which articles of the AI Act apply to my system?",
  "Show me the Datalog rules that led to this conclusion",
  "What would change if the system is not high-risk?",
];

export function FollowUpCard({ onSend }: Props) {
  return (
    <div className="panel-card">
      <div className="text-label" style={{ marginBottom: 8 }}>Follow-up</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {FOLLOW_UPS.map((f) => (
          <button key={f} type="button" className="followup-chip" onClick={() => onSend(f)}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
