import { PixelIcon } from "../components/ui/PixelIcon";

interface Props {
  onProductPath: () => void;
  onChatPath: () => void;
}

export function StartPage({ onProductPath, onChatPath }: Props) {
  return (
    <div className="ct-page">
      <h1 className="ct-start-hero">Which laws apply, why, and what next?</h1>
      <p className="ct-page-sub ct-start-sub">
        Choose how you want to work — a guided three-step scan or a free-form compliance chat.
      </p>

      <section className="ct-fork-card-static ct-fork-card-with-icon">
        <PixelIcon name="productConsole" size={96} className="ct-path-icon" />
        <div className="ct-fork-card-text">
          <h2 className="ct-fork-card-title">Product or service</h2>
          <p className="ct-fork-card-body">
            Describe your product in three guided steps.
            <br />
            Build a knowledge graph, scan laws, then assess applicability.
          </p>
          <button type="button" className="ct-btn-primary" onClick={onProductPath}>
            Start 3-step scan
          </button>
        </div>
      </section>

      <hr className="ct-rule" aria-hidden />

      <section className="ct-fork-card-static ct-fork-card-with-icon">
        <PixelIcon name="legalSand" size={96} className="ct-path-icon" />
        <div className="ct-fork-card-text">
          <h2 className="ct-fork-card-title">Compliance chat</h2>
          <p className="ct-fork-card-body">
            Ask questions in plain language.
            <br />
            Get answers on GDPR, the AI Act, and other EU rules.
          </p>
          <button type="button" className="ct-btn-primary" onClick={onChatPath}>
            Open chat
          </button>
        </div>
      </section>
    </div>
  );
}
