import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import ptBR from './pt-BR.json';

/** English by default; Portuguese when the browser asks for it. */
export function detectLanguage(languages: readonly string[] = navigator.languages): string {
  return languages.some((language) => language.toLowerCase().startsWith('pt')) ? 'pt-BR' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, 'pt-BR': { translation: ptBR } },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
