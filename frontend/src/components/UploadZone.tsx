import { useCallback, useRef } from "react";
import { useLanguage } from "../i18n/LanguageContext.js";

export interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
}

export function UploadZone({ onFileSelect, accept = ".pdf,.pptx" }: UploadZoneProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        style={{ flexDirection: "column", padding: 34, borderStyle: "dashed" }}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        aria-label={t("video.dropTitle")}
      >
        <strong>{t("video.dropTitle")}</strong>
        <span className="hint">{t("video.dropHint")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
