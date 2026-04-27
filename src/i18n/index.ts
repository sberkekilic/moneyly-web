import { tr } from './tr';
import { en } from './en';

export type Language = 'tr' | 'en';
export type TranslationKeys = typeof tr;

const translations: Record<Language, TranslationKeys> = { tr, en };

export function useTranslation() {
  // This is a hook-compatible function
  // In client components, use the zustand store
  if (typeof window === 'undefined') return tr;
  
  const lang = localStorage.getItem('language') as Language | null;
  return translations[lang || 'tr'] || tr;
}

export function t(lang: Language = 'tr'): TranslationKeys {
  return translations[lang] || tr;
}