import { useRef } from "react";
import { PixelIcon } from "../ui/PixelIcon";
interface Props {
  description: string;
  files: File[];
  parsing: boolean;
  canContinue: boolean;
  onDescriptionChange: (v: string) => void;
  onFilesChange: (files: File[]) => void;
  onSeeLaws: () => void | Promise<void>;
}

export function ProductIntakePanel({
  description,
  files,
  parsing,
  canContinue,
  onDescriptionChange,
  onFilesChange,
  onSeeLaws,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const showWriteHint = !description.trim();

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!next.find((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    onFilesChange(next);
  }

  return (
    <div
      className="ct-product-column"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      <header className="ct-scanner-head">
        <PixelIcon name="productConsole" size={96} className="ct-scanner-head-icon" />
        <div className="ct-scanner-head-text">
          <p className="ct-scanner-step">Step 1</p>
          <p className="ct-scanner-intro">
            Describe your product or service. The map updates as you type.
          </p>
        </div>
      </header>

      <div className="ct-product-write-zone">
        {showWriteHint && (
          <p className="ct-product-write-hint" aria-hidden="true">
            Write here your product or service description
          </p>
        )}
        <textarea
          id="product-description"
          className="textarea ct-product-chat-input"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder=""
          aria-label="Product or service description"
        />
      </div>

      <div className="ct-product-actions">
        <button
          type="button"
          className="ct-product-upload-btn"
          onClick={() => fileRef.current?.click()}
        >
          <PixelIcon name="document" size={56} className="ct-product-upload-icon" />
          <span className="ct-product-upload-text">
            <span className="ct-product-upload-label">Upload document</span>
            <span className="ct-product-upload-hint">PDF, DOCX, TXT, MD</span>
          </span>
        </button>

        <button
          type="button"
          className="ct-btn-primary ct-product-cta"
          disabled={!canContinue || parsing}
          onClick={() => void onSeeLaws()}
        >
          See which laws apply
        </button>
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
      {files.length > 0 && (
        <p className="ct-product-files text-sm">
          {files.map((f) => f.name).join(" · ")}
        </p>
      )}
      {parsing && (
        <p className="ct-product-parsing text-sm">
          <PixelIcon name="hourglass" size={36} className="ct-product-parsing-icon" />
          Updating graph…
        </p>
      )}
    </div>
  );
}
