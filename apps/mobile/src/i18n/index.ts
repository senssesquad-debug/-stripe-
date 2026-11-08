import { resolveLocale, type Locale } from '@passtra/core';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import el from './el';
import en from './en';
import ru from './ru';

export const deviceLocale = (): Locale => resolveLocale(getLocales()[0]?.languageTag);

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, el: { translation: el }, ru: { translation: ru } },
  lng: deviceLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', el: 'Ελληνικά', ru: 'Русский' };
export default i18n;
