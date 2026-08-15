import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { setAuthenticatorLocale } from "./authenticator.js";
import {
  createTranslate,
  formatMessage,
  type Locale,
  type MessageDescriptor,
  type Translate,
} from "./messages.js";
import {
  getInitialLocale,
  persistLocale,
  updateDocumentLocale,
} from "./locale.js";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  format: (descriptor: MessageDescriptor) => string;
}

interface LanguageProviderProps extends PropsWithChildren {
  initialLocale?: Locale;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

function applyLocale(locale: Locale): void {
  persistLocale(locale);
  updateDocumentLocale(locale);
  setAuthenticatorLocale(locale);
}

export function LanguageProvider({
  children,
  initialLocale,
}: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? getInitialLocale(),
  );

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    applyLocale(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const t = useMemo(() => createTranslate(locale), [locale]);
  const format = useCallback(
    (descriptor: MessageDescriptor) => formatMessage(locale, descriptor),
    [locale],
  );
  const value = useMemo(
    () => ({ locale, setLocale, t, format }),
    [format, locale, setLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("LanguageProvider内でuseLanguageを使用してください。");
  }

  return context;
}
