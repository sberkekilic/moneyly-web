import { create } from 'zustand';

type Language = 'tr' | 'en';

const isClient = typeof window !== 'undefined';

interface SettingsState {
  language: Language;
  setLanguage: (lang: Language) => void;
  loadSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'tr',

  loadSettings: () => {
    if (!isClient) return;
    const savedLang = localStorage.getItem('language') as Language | null;
    set({ language: savedLang || 'tr' });
  },

  setLanguage: (lang) => {
    set({ language: lang });
    if (isClient) {
      localStorage.setItem('language', lang);
    }
  },
}));