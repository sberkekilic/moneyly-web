// src/hooks/useTranslate.ts
'use client';

import { useSettingsStore } from '@/store/settingsStore';
import { tr } from '@/i18n/tr';
import { en } from '@/i18n/en';

const translations: Record<string, typeof tr> = { tr, en };

export function useTranslate() {
  const language = useSettingsStore((s) => s.language) || 'tr';
  return translations[language] || tr;
}