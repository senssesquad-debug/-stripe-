/** Supported UI locales. Add a new locale here, then add translations; nothing else is hard-coded. */
export const LOCALES = ['en', 'el', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type LocalizedText = { en: string } & Partial<Record<Locale, string>>;

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** Pick the best translation, falling back to English. */
export function pickText(text: LocalizedText | undefined | null, locale: Locale): string {
  if (!text) return '';
  return text[locale] ?? text.en;
}

/** Map an arbitrary BCP-47 tag (e.g. "ru-RU", "el_CY") to a supported locale. */
export function resolveLocale(tag: string | undefined | null): Locale {
  if (!tag) return DEFAULT_LOCALE;
  const base = tag.toLowerCase().replace('_', '-').split('-')[0];
  return isLocale(base) ? base : DEFAULT_LOCALE;
}
