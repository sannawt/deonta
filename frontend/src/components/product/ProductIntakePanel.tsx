import { useRef } from "react";
import {
  INTAKE_CARDS,
  type IntakeFieldSources,
  type ProductIntakeState,
} from "../../lib/kgIntakeSchema";
import { PixelIcon } from "../ui/PixelIcon";
import { ProductIntakeForm } from "./ProductIntakeForm";

const SUGGESTED_DOCS = [
  "Privacy policy",
  "Product specifications",
  "Terms of service",
  "Data processing agreements",
];

interface Props {
  intake: ProductIntakeState;
  fieldSources: IntakeFieldSources;
  extractSummary: string[];
  files: File[];
  parsing: boolean;
  canContinue: boolean;
  onIntakeChange: (patch: Partial<ProductIntakeState>) => void;
  onFilesChange: (files: File[]) => void;
  onSeeLaws: () => void | Promise<void>;
}

export function ProductIntakePanel({
  intake,
  fieldSources,
  extractSummary,
  files,
  parsing,
  canContinue,
  onIntakeChange,
  onFilesChange,
  onSeeLaws,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!next.find((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onFilesChange(next);
  }

  return (
    <div
      className="ct-product-column ct-intake-panel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div className="ct-intake-three-boxes">
        {INTAKE_CARDS.map((card) => (
          <section
            key={card.id}
            className="ct-intake-box"
            aria-labelledby={`intake-box-${card.id}`}
          >
            <header className="ct-intake-box-head">
              <h2 className="ct-intake-box-title" id={`intake-box-${card.id}`}>
                {card.title}
              </h2>
              {card.prompt ? <p className="ct-intake-box-prompt">{card.prompt}</p> : null}
            </header>

            {card.id === "product" ? (
              <div className="ct-intake-upload-inline">
                <div className="ct-intake-upload-bar">
                  <div className="ct-intake-upload-side">
                    {SUGGESTED_DOCS.slice(0, 2).map((doc) => (
                      <button
                        key={doc}
                        type="button"
                        className="ct-intake-doc-chip"
                        onClick={() => fileRef.current?.click()}
                      >
                        {doc}
                      </button>
                    ))}
                  </div>

                  <span className="ct-intake-upload-or" aria-hidden="true">
                    OR
                  </span>

                  <button
                    type="button"
                    className="ct-intake-upload-center"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Upload documents"
                    title="Upload documents (PDF, DOCX, TXT, MD)"
                  >
                    <PixelIcon name="document" size={36} className="ct-intake-upload-icon" alt="" />
                    <span className="ct-intake-upload-center-label">Upload documents</span>
                  </button>

                  <span className="ct-intake-upload-or" aria-hidden="true">
                    OR
                  </span>

                  <div className="ct-intake-upload-side">
                    {SUGGESTED_DOCS.slice(2).map((doc) => (
                      <button
                        key={doc}
                        type="button"
                        className="ct-intake-doc-chip"
                        onClick={() => fileRef.current?.click()}
                      >
                        {doc}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="ct-intake-upload-formats">PDF · DOCX · TXT · MD — or drag files here</p>

                {files.length > 0 ? (
                  <ul className="ct-intake-file-stack">
                    {files.map((f) => (
                      <li key={`${f.name}-${f.size}`}>{f.name}</li>
                    ))}
                  </ul>
                ) : null}

                {extractSummary.length > 0 ? (
                  <p className="ct-intake-extract-summary">
                    We found: {extractSummary.join(", ")} — please confirm below.
                  </p>
                ) : null}
              </div>
            ) : null}

            <ProductIntakeForm
              card={card.id}
              intake={intake}
              fieldSources={fieldSources}
              onChange={onIntakeChange}
            />
          </section>
        ))}
      </div>

      {parsing ? <p className="ct-intake-parsing">Building knowledge graph…</p> : null}

      <footer className="ct-intake-sheet-footer ct-intake-sheet-footer--sticky">
        <span />
        <button
          type="button"
          className="ct-intake-next-btn"
          disabled={!canContinue || parsing}
          onClick={() => void onSeeLaws()}
        >
          See which laws apply
        </button>
      </footer>

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
    </div>
  );
}
