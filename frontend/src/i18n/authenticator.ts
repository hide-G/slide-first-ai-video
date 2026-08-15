import { translations } from "@aws-amplify/ui-react";
import { I18n } from "aws-amplify/utils";
import type { Locale } from "./messages.js";

export function initializeAuthenticatorI18n(locale: Locale): void {
  I18n.putVocabularies(translations);
  I18n.setLanguage(locale);
}

export function setAuthenticatorLocale(locale: Locale): void {
  I18n.setLanguage(locale);
}
