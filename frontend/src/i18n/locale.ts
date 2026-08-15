import { createTranslate, type Locale } from "./messages.js";

export const DEFAULT_LOCALE: Locale = "ja";
export const LOCALE_STORAGE_KEY = "slide-first.locale";

export function isLocale(value: unknown): value is Locale {
  return value === "ja" || value === "en";
}

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ストレージを利用できない環境でも、画面上の切替は継続する。
  }
}

export function updateDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
  document.title = createTranslate(locale)("app.title");
}
