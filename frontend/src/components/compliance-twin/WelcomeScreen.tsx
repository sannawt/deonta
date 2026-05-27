const STARTERS = [
  "Cloud HR platform in Finland processing employee payroll data",
  "AI-powered recruitment tool screening EU job applicants",
  "US SaaS company offering analytics to EU hospitals",
  "Chatbot giving medical advice to German patients",
];

interface Props {
  onSend: (text: string) => void;
}

export function WelcomeScreen({ onSend }: Props) {
  return (
    <div id="welcome">
      <svg width="240" height="52" viewBox="0 0 220 48" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6 L8 6 L8 42 L18 42" fill="none" stroke="var(--blue-dk)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M30 6 L40 6 L40 42 L30 42" fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="24" cy="24" r="3.5" fill="var(--blue)"/>
        <text x="56" y="31" fontFamily="'Plus Jakarta Sans',Arial,sans-serif" fontSize="18" fontWeight="700" fill="var(--txt)" letterSpacing="-0.3">ComplianceTwin</text>
      </svg>

      <div className="welcome-title">Regulatory compliance assistant</div>
      <div className="welcome-sub">
        Ask a question about your product or scenario and receive a structured scope analysis for EU regulations.
      </div>

      <div className="hint-grid">
        {STARTERS.map((s) => (
          <button key={s} type="button" className="hint" onClick={() => onSend(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
