// lib/i18n/locale.ts
//
// Source unique du changement de langue : la langue est geree par
// cookie (NEXT_LOCALE, lu dans i18n.ts), JAMAIS par prefixe d'URL
// (/fr/... n'existe pas et rend une 404).
export const SUPPORTED_LOCALES = ["en", "fr", "zh"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function buildLocaleCookie(locale: string): string {
  if (!isSupportedLocale(locale)) {
    throw new Error(
      `Unsupported locale "${locale}" (expected ${SUPPORTED_LOCALES.join(", ")})`
    );
  }
  return `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
}
