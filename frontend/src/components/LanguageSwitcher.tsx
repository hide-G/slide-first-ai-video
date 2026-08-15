import { useLanguage } from "../i18n/LanguageContext.js";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("language.switcherLabel")}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
    >
      <button
        type="button"
        onClick={() => setLocale("ja")}
        aria-pressed={locale === "ja"}
      >
        {t("language.japanese")}
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        {t("language.english")}
      </button>
    </div>
  );
}
