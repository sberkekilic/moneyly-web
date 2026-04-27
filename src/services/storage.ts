// ============================================
// STORAGE SERVICE
// Converted from: lib/services/storage.dart
// Uses localStorage instead of SharedPreferences
// ============================================

const KEYS = {
  TRANSACTIONS: 'transactions',
  ACCOUNT_DATA_LIST: 'accountDataList',
  SELECTED_ACCOUNT: 'selectedAccount',
  INCOMES: 'personal_incomes',
  INCOME_SUMMARY: 'income_summary',
  INVESTMENTS: 'investments',
  EXCHANGE_DOLLAR_LIST: 'exchangeDollarList',
  INCOME_MAP: 'incomeMap',
  SELECTED_OPTION: 'selected_option',
  INVOICES: 'invoices',
  USER_CATEGORIES: 'userCategories',
  IS_LOGGED_IN: 'isLoggedIn',
  LANGUAGE: 'language',
  DARK_MODE: 'darkMode',
  THEME_MODE: 'themeMode',
  START_DATE: 'startDate',
  END_DATE: 'endDate',
} as const;

export type StorageKey = typeof KEYS[keyof typeof KEYS];

// ── Core read/write ───────────────────────────────────────────────

const isClient = typeof window !== 'undefined';

export const storage = {
  get: <T>(key: string, fallback?: T): T | null => {
    if (!isClient) return fallback ?? null;
    try {
      const item = localStorage.getItem(key);
      if (item === null) return fallback ?? null;
      return JSON.parse(item) as T;
    } catch {
      return fallback ?? null;
    }
  },

  set: <T>(key: string, value: T): void => {
    if (!isClient) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Storage.set error for key "${key}":`, e);
    }
  },

  remove: (key: string): void => {
    if (!isClient) return;
    localStorage.removeItem(key);
  },

  getString: (key: string): string | null => {
    if (!isClient) return null;
    return localStorage.getItem(key);
  },

  setString: (key: string, value: string): void => {
    if (!isClient) return;
    localStorage.setItem(key, value);
  },

  getBool: (key: string): boolean | null => {
    const val = localStorage.getItem(key);
    if (val === null) return null;
    return val === 'true';
  },

  setBool: (key: string, value: boolean): void => {
    if (!isClient) return;
    localStorage.setItem(key, String(value));
  },

  clear: (): void => {
    if (!isClient) return;
    localStorage.clear();
  },
};

export { KEYS };