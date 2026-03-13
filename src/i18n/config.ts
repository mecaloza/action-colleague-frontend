export const locales = ["es", "en", "pt"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "es";

export const LANGUAGE_STORAGE_KEY = "ac_language";

export function isValidLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}
