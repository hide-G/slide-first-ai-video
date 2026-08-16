import { useLanguage } from "../i18n/LanguageContext.js";
import type { MessageKey } from "../i18n/messages.js";

export type SsmlTag = "sub" | "phoneme" | "say-as" | "break" | "prosody" | "emphasis";

export interface SsmlToolbarButton {
  tag: SsmlTag;
  labelKey: MessageKey;
  /** Wrap template - "|" marks cursor position */
  wrap?: string;
  /** Insert template (no selection needed) */
  insert?: string;
}

const TOOLBAR_BUTTONS: SsmlToolbarButton[] = [
  { tag: "sub", labelKey: "video.ssmlSub", wrap: '<sub alias="reading">|</sub>' },
  { tag: "sub", labelKey: "video.ssmlRuby", wrap: '<sub alias="furigana">|</sub>' },
  { tag: "phoneme", labelKey: "video.ssmlPhoneme", wrap: '<phoneme alphabet="x-sampa" ph="">|</phoneme>' },
  { tag: "say-as", labelKey: "video.ssmlSpell", wrap: '<say-as interpret-as="characters">|</say-as>' },
  { tag: "break", labelKey: "video.ssmlBreak", insert: '<break time="400ms"/>' },
  { tag: "prosody", labelKey: "video.ssmlRate", wrap: '<prosody rate="95%">|</prosody>' },
  { tag: "emphasis", labelKey: "video.ssmlEmphasis", wrap: '<emphasis level="moderate">|</emphasis>' },
];

/**
 * Returns the set of tags that are UNSUPPORTED for the given engine.
 * Neural engine does NOT support: emphasis, prosody pitch (we disable prosody partially).
 * Standard supports all.
 */
export function getUnsupportedTags(engine: "neural" | "standard"): Set<SsmlTag> {
  if (engine === "standard") {
    return new Set();
  }
  // Neural: emphasis is not supported
  return new Set(["emphasis"]);
}

export interface SsmlToolbarProps {
  engine: "neural" | "standard";
  ssmlMode: boolean;
  onInsert: (text: string) => void;
  onCheatsheetToggle: () => void;
  cheatsheetOpen: boolean;
}

export function SsmlToolbar({ engine, ssmlMode, onInsert, onCheatsheetToggle, cheatsheetOpen }: SsmlToolbarProps) {
  const { t } = useLanguage();
  const unsupported = getUnsupportedTags(engine);

  return (
    <div
      className="toolbar"
      role="group"
      aria-label={t("video.ssmlToolbar")}
      style={{ display: ssmlMode ? undefined : "none" }}
    >
      {TOOLBAR_BUTTONS.map((btn, index) => {
        const isDisabled = !ssmlMode || unsupported.has(btn.tag);
        return (
          <button
            key={index}
            type="button"
            disabled={isDisabled}
            data-ssml-tag={btn.tag}
            onClick={() => {
              const text = btn.insert ?? btn.wrap?.replace("|", "") ?? "";
              onInsert(text);
            }}
            title={isDisabled && unsupported.has(btn.tag) ? t("video.supportNone") : undefined}
          >
            {t(btn.labelKey)}
          </button>
        );
      })}
      <button
        type="button"
        disabled={!ssmlMode}
        aria-expanded={cheatsheetOpen}
        aria-controls="ssml-cheatsheet"
        onClick={onCheatsheetToggle}
      >
        {t("video.cheatsheetOpen")}
      </button>
    </div>
  );
}
