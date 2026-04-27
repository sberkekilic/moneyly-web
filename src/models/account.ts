// ============================================
// ACCOUNT MODEL
// Converted from: lib/models/account.dart
// ============================================

import { Transaction } from './transaction';

export interface Account {
  accountId: number;
  name: string;
  type: string;
  balance?: number;
  transactions: Transaction[];
  debts: unknown[];
  currency: string;
  isDebit: boolean;
  // Credit card specific
  creditLimit?: number;
  availableCredit?: number;
  remainingDebt?: number;
  minPayment?: number;
  remainingMinPayment?: number;
  previousDebt?: number;
  totalDebt?: number;
  currentDebt?: number;
  cutoffDate: number;
  // Period dates (stored as dd/MM/yyyy strings like Flutter)
  previousCutoffDate?: string;
  nextCutoffDate?: string;
  previousDueDate?: string;
  nextDueDate?: string;
}

export interface BankData {
  bankName: string;
  accounts: Account[];
}

// ── Computed helpers ──────────────────────────────────────────────

export const calculateMinPayment = (account: Account): number => {
  if (!account.creditLimit || !account.totalDebt) return 0;
  if (account.creditLimit < 25000) return account.totalDebt * 0.20;
  if (account.creditLimit > 50000) return account.totalDebt * 0.40;
  return account.totalDebt * 0.30;
};

export const getActualCutoffDate = (account: Account, baseDate: Date): Date => {
  let tentative = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    account.cutoffDate
  );
  while (tentative.getDay() === 0 || tentative.getDay() === 6) {
    tentative = new Date(tentative.getTime() + 86400000);
  }
  return tentative;
};

export const isCreditCard = (account: Account): boolean => !account.isDebit;

export const createAccount = (
  partial: Partial<Account> & Pick<Account, 'name' | 'currency'>
): Account => ({
  accountId: Date.now(),
  name: partial.name,
  type: 'debit',
  balance: 0,
  transactions: [],
  debts: [],
  currency: partial.currency,
  isDebit: true,
  cutoffDate: 1,
  ...partial,
});