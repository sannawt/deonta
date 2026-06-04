import { PixelIcon } from "../components/ui/PixelIcon";

interface Props {
  onProductPath: () => void;
  onLawPath: (codes: string[]) => void;
  lawOptions: { code: string; label: string; short?: string; engine_mode: string }[];
  selectedLaws: string[];
  onToggleLaw: (code: string) => void;
}

export function StartPage({
  onProductPath,
  onLawPath,
  lawOptions,
  selectedLaws,
  onToggleLaw,
}: Props) {
  const symbolic = lawOptions.filter((l) => l.engine_mode === "symbolic" && !l.code.startsWith("us"));
  const other = lawOptions.filter((l) => l.engine_mode !== "planned" && !symbolic.includes(l));

  return (
    <div className="ct-page">
      <p className="ct-welcome-hello">
        Hello, welcome to ComplianceTwin. Choose how you want to start.
      </p>

      <section className="ct-fork-card-static ct-fork-card-with-icon">
        <PixelIcon name="productConsole" size={72} className="ct-path-icon" />
        <div className="ct-fork-card-text">
          <h2 className="ct-fork-card-title">I have a product or service</h2>
          <p className="ct-fork-card-body">Upload · review · check which laws apply</p>
          <button type="button" className="ct-btn-primary" onClick={onProductPath}>
            Start
          </button>
        </div>
      </section>

      <hr className="ct-rule" aria-hidden />

      <section className="ct-fork-card-static ct-fork-card-with-icon">
        <PixelIcon name="legalSand" size={72} className="ct-path-icon" />
        <div className="ct-fork-card-text">
          <h2 className="ct-fork-card-title">I am interested in a law</h2>
          <p className="ct-fork-card-body">Obligations and evidence checklist</p>
          <div className="ct-law-chips">
            {symbolic.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`ct-chip ${selectedLaws.includes(l.code) ? "active" : ""}`}
                onClick={() => onToggleLaw(l.code)}
              >
                {l.label}
              </button>
            ))}
            {other.slice(0, 8).map((l) => (
              <button
                key={l.code}
                type="button"
                className={`ct-chip ${selectedLaws.includes(l.code) ? "active" : ""}`}
                onClick={() => onToggleLaw(l.code)}
              >
                {l.short || l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ct-btn-primary"
            disabled={selectedLaws.length === 0}
            onClick={() => onLawPath(selectedLaws)}
          >
            Start
          </button>
        </div>
      </section>
    </div>
  );
}
