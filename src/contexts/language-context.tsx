"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale, type AppLocale } from "@/i18n/config";
import esMessages from "@/i18n/messages/es.json";
import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";

type Messages = typeof esMessages;

const MESSAGES_BY_LOCALE: Record<AppLocale, Messages> = {
  es: esMessages,
  en: enMessages,
  pt: ptMessages,
};

interface LanguageContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // The interface is Spanish-only now; a language saved by the previous version is ignored.
  const [locale, setLocaleState] = useState<AppLocale>(defaultLocale);
  const setLocale = (nextLocale: AppLocale) => setLocaleState(nextLocale);

  const value = useMemo(
    () => ({ locale, setLocale }),
    [locale]
  );

  return (
    <LanguageContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES_BY_LOCALE[locale]}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
