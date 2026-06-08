import { useRef, useState } from "react";
import { PixelIcon } from "../ui/PixelIcon";

const INTAKE_STEPS = [
  {
    id: 1,
    title: "Product or service",
    prompt: "What is your product or service? Describe what it does and who uses it.",
    placeholder: "e.g. A B2B SaaS platform that helps manufacturers monitor equipment sensors…",
    field: "product" as const,
  },
  {
    id: 2,
    title: "Customers and location",
    prompt: "Where are your customers, and where is your organization located?",
    placeholder: "e.g. Customers in the EU and UK. Company based in Finland with a US subsidiary…",
    field: "markets" as const,
  },
  {
    id: 3,
    title: "Supporting documents",
    prompt: "Or provide documents that describe your product and practices.",
    placeholder: "",
    field: "documents" as const,
  },
] as const;

const SUGGESTED_DOCS = [
  "Product specifications or technical documentation",
  "Privacy policy",
  "Terms of service",
  "Data processing agreements",
  "Security or compliance policies",
];

interface Props {
  productInfo: string;
  marketsAndLocation: string;
  files: File[];
  parsing: boolean;
  canContinue: boolean;
  onProductInfoChange: (v: string) => void;
  onMarketsAndLocationChange: (v: string) => void;
  onFilesChange: (files: File[]) => void;
  onSeeLaws: () => void | Promise<void>;
}

export function ProductIntakePanel({
  productInfo,
  marketsAndLocation,
  files,
  parsing,
  canContinue,
  onProductInfoChange,
  onMarketsAndLocationChange,
  onFilesChange,
  onSeeLaws,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const current = INTAKE_STEPS[step - 1];

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!next.find((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onFilesChange(next);
  }

  const productValue = productInfo;
  const marketsValue = marketsAndLocation;
  const showWriteHint =
    current.field === "product"
      ? !productValue.trim()
      : current.field === "markets"
        ? !marketsValue.trim()
        : false;

  const canAdvanceFromProduct =
    productInfo.trim().length >= 12 || files.length > 0;
  const canAdvanceFromMarkets = true;

  function handleContinue() {
    if (step === 1 && !canAdvanceFromProduct) return;
    if (step < 3) setStep(step + 1);
  }

  return (
    <div
      className="ct-product-column"
      onDragOver={(e) => {
        if (current.field === "documents") e.preventDefault();
      }}
      onDrop={(e) => {
        if (current.field !== "documents") return;
        e.preventDefault();
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      <nav className="ct-intake-progress" aria-label="Intake progress">
        {INTAKE_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`ct-intake-progress-item${s.id === step ? " ct-intake-progress-item--current" : ""}${s.id < step ? " ct-intake-progress-item--done" : ""}`}
            onClick={() => {
              if (s.id < step) setStep(s.id);
            }}
            disabled={s.id > step}
            aria-current={s.id === step ? "step" : undefined}
          >
            <span className="ct-intake-progress-num">{s.id}</span>
            <span className="ct-intake-progress-label">{s.title}</span>
          </button>
        ))}
      </nav>

      <div className="ct-intake-step-head">
        <p className="ct-intake-step-prompt">{current.prompt}</p>
      </div>

      {current.field === "documents" ? (
        <div className="ct-intake-doc-zone">
          <ul className="ct-intake-doc-list">
            {SUGGESTED_DOCS.map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>

          <button
            type="button"
            className="ct-product-upload-btn ct-intake-upload-btn"
            onClick={() => fileRef.current?.click()}
          >
            <PixelIcon name="document" size={56} className="ct-product-upload-icon" />
            <span className="ct-product-upload-text">
              <span className="ct-product-upload-label">Upload documents</span>
              <span className="ct-product-upload-hint">PDF, DOCX, TXT, MD — drag and drop here</span>
            </span>
          </button>

          {files.length > 0 && (
            <p className="ct-product-files text-sm">
              {files.map((f) => f.name).join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <div className="ct-product-write-zone">
          {showWriteHint && (
            <p className="ct-product-write-hint" aria-hidden="true">
              {current.placeholder}
            </p>
          )}
          <textarea
            id={current.field === "product" ? "product-description" : "product-markets"}
            className="textarea ct-product-chat-input"
            value={current.field === "product" ? productValue : marketsValue}
            onChange={(e) =>
              current.field === "product"
                ? onProductInfoChange(e.target.value)
                : onMarketsAndLocationChange(e.target.value)
            }
            placeholder=""
            aria-label={current.title}
          />
        </div>
      )}

      <div className="ct-product-actions ct-intake-actions">
        {step > 1 && (
          <button
            type="button"
            className="ct-btn-outline ct-intake-back"
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        )}

        {step < 3 ? (
          <>
            <button
              type="button"
              className="ct-btn-primary ct-product-cta"
              disabled={step === 1 ? !canAdvanceFromProduct : !canAdvanceFromMarkets}
              onClick={handleContinue}
            >
              Continue
            </button>
            {step === 1 && (
              <button
                type="button"
                className="ct-intake-skip-link"
                onClick={() => setStep(3)}
              >
                Or upload documents instead
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="ct-btn-primary ct-product-cta"
            disabled={!canContinue || parsing}
            onClick={() => void onSeeLaws()}
          >
            See which laws apply
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.txt,.md,.doc,.docx"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {parsing && (
        <p className="ct-product-parsing text-sm">
          <PixelIcon name="hourglass" size={36} className="ct-product-parsing-icon" />
          Reading your input…
        </p>
      )}
    </div>
  );
}
