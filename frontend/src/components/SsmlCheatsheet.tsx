import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.js";
import type { SsmlTag } from "./SsmlToolbar.js";

interface CheatsheetRow {
  purpose: string;
  tag: string;
  supportedNeural: boolean;
  ssmlTag: SsmlTag;
}

const CHEATSHEET_ROWS: CheatsheetRow[] = [
  { purpose: "sub", tag: '<sub alias="...">text</sub>', supportedNeural: true, ssmlTag: "sub" },
  { purpose: "phoneme", tag: '<phoneme alphabet="x-sampa" ph="...">text</phoneme>', supportedNeural: true, ssmlTag: "phoneme" },
  { purpose: "say-as", tag: '<say-as interpret-as="characters">text</say-as>', supportedNeural: true, ssmlTag: "say-as" },
  { purpose: "break", tag: '<break time="400ms"/>', supportedNeural: true, ssmlTag: "break" },
  { purpose: "prosody", tag: '<prosody rate="95%">text</prosody>', supportedNeural: true, ssmlTag: "prosody" },
  { purpose: "emphasis", tag: '<emphasis level="moderate">text</emphasis>', supportedNeural: false, ssmlTag: "emphasis" },
];

export interface SsmlCheatsheetProps {
  engine: "neural" | "standard";
  open: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
}

export function SsmlCheatsheet({ engine, open, onClose, onInsert }: SsmlCheatsheetProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    if (!open) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 20;
    switch (e.key) {
      case "ArrowUp":
        setPosition((p) => ({ ...p, y: p.y - step }));
        e.preventDefault();
        break;
      case "ArrowDown":
        setPosition((p) => ({ ...p, y: p.y + step }));
        e.preventDefault();
        break;
      case "ArrowLeft":
        setPosition((p) => ({ ...p, x: p.x - step }));
        e.preventDefault();
        break;
      case "ArrowRight":
        setPosition((p) => ({ ...p, x: p.x + step }));
        e.preventDefault();
        break;
    }
  }, []);

  if (!open) return null;

  return (
    <section
      ref={panelRef}
      className="cheatsheet"
      id="ssml-cheatsheet"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cheatsheet-title"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 1000,
        resize: "both",
        overflow: "auto",
        maxWidth: "90vw",
        maxHeight: "80vh",
        minWidth: 400,
        minHeight: 300,
        background: "white",
        border: "1px solid #ccc",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <div
        className="cheatsheet-head"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        style={{ cursor: "move", padding: "12px 16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h2 id="cheatsheet-title" style={{ margin: 0, fontSize: "1rem" }}>
          {t("video.cheatsheetTitle")}
          <span style={{ marginLeft: 8, fontSize: "0.85em", color: "#666" }}>({engine})</span>
        </h2>
        <button type="button" onClick={onClose}>
          {t("video.cheatsheetClose")}
        </button>
      </div>

      <div className="cheatsheet-body" style={{ padding: 16 }}>
        <p className="hint" style={{ marginTop: 0 }}>
          {t("video.cheatsheetMoveHelp")}
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>{t("video.cheatsheetThPurpose")}</th>
              <th>{t("video.cheatsheetThTag")}</th>
              <th>{t("video.cheatsheetThSupport")}</th>
              <th><span className="visually-hidden">{t("video.cheatsheetThInsert")}</span></th>
            </tr>
          </thead>
          <tbody>
            {CHEATSHEET_ROWS.map((row) => {
              const supported = engine === "standard" || row.supportedNeural;
              return (
                <tr key={row.purpose}>
                  <td>{row.purpose}</td>
                  <td><code>{row.tag}</code></td>
                  <td>{supported ? t("video.supportFull") : t("video.supportNone")}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!supported}
                      onClick={() => onInsert(row.tag)}
                    >
                      {t("video.cheatsheetInsert")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="note note-warn" style={{ marginTop: 14 }}>{t("video.cheatsheetNote1")}</p>
        <p className="note note-warn">{t("video.cheatsheetNote2")}</p>
        <p className="note">{t("video.cheatsheetNote3")}</p>
        <p className="hint">{t("video.cheatsheetSource")}</p>
      </div>
    </section>
  );
}
