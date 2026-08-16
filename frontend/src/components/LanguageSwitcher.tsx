import { useLanguage } from "../i18n/LanguageContext.js";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("common.uiLang")}
      className="lang-toggle"
    >
      <button
        type="button"
        className="lang-btn"
        onClick={() => setLocale("ja")}
        aria-pressed={locale === "ja"}
      >
        日本語
      </button>
      <button
        type="button"
        className="lang-btn"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        English
      </button>
    </div>
  );
}
