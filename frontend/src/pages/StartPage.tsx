import { PixelIcon } from "../components/ui/PixelIcon";

interface Props {
  onProductPath: () => void;
  onLawPath: (codes: string[]) => void;
  lawOptions: { code: string; label: string; short?: string; engine_mode: string }[];
  selectedLaws: string[];
  onToggleLaw: (code: string) => void;
}

const START_PAGE_REGULATIONS: { code: string; label: string }[] = [
  { code: "gdpr", label: "GDPR" },
  { code: "ai_act", label: "EU AI Act" },
  { code: "cra", label: "CRA" },
  { code: "dora", label: "DORA" },
  { code: "nis2", label: "NIS2" },
];

function regulationsForDisplay(
  lawOptions: Props["lawOptions"]
): { code: string; label: string }[] {
  const byCode = new Map(lawOptions.map((l) => [l.code, l.short || l.label]));
  return START_PAGE_REGULATIONS.filter((item) => !lawOptions.length || byCode.has(item.code)).map(
    (item) => ({
      code: item.code,
      label: byCode.get(item.code) || item.label,
    })
  );
}

export function StartPage({
  onProductPath,
  onLawPath,
  lawOptions,
  selectedLaws,
  onToggleLaw,
}: Props) {
  const regulations = regulationsForDisplay(lawOptions);

  return (
    <div className="ct-page">
      <h1 className="ct-start-hero">Which laws apply, why, and what next?</h1>

      <section className="ct-fork-card-static ct-fork-card-with-icon">
        <PixelIcon name="productConsole" size={96} className="ct-path-icon" />
        <div className="ct-fork-card-text">
          <h2 className="ct-fork-card-title">Product or service</h2>
          <p className="ct-fork-card-body">
            Describe your product.
            <br />
            Get an applicability assessment across EU/US rules.
          </p>
          <button type="button" className="ct-btn-primary" onClick={onProductPath}>
            Start scan
          </button>
        </div>
      </section>

      <hr className="ct-rule" aria-hidden />

      <section className="ct-fork-card-static ct-fork-card-with-icon">
        <PixelIcon name="legalSand" size={96} className="ct-path-icon" />
        <div className="ct-fork-card-text">
          <h2 className="ct-fork-card-title">Regulation</h2>
          <p className="ct-fork-card-body">
            Choose a regulation.
            <br />
            Review scope, obligations, and evidence needs.
          </p>
          <div className="ct-law-chips ct-law-chips--dotted" role="group" aria-label="Select regulations">
            {regulations.map((law, index) => (
              <span key={law.code} className="ct-law-chip-group">
                {index > 0 && (
                  <span className="ct-law-chip-sep" aria-hidden>
                    ·
                  </span>
                )}
                <button
                  type="button"
                  className={`ct-chip ${selectedLaws.includes(law.code) ? "active" : ""}`}
                  onClick={() => onToggleLaw(law.code)}
                >
                  {law.label}
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="ct-btn-primary"
            disabled={selectedLaws.length === 0}
            onClick={() => onLawPath(selectedLaws)}
          >
            Continue
          </button>
        </div>
      </section>

      <footer className="ct-page-footer">
        <p className="ct-page-footer-copy">© {new Date().getFullYear()} ComplianceTwin</p>
      </footer>
    </div>
  );
}
