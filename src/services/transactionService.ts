// ============================================
// TRANSACTION SERVICE
// Converted from: lib/models/transaction.dart (TransactionService)
// ============================================

import { Transaction, createTransaction } from '@/models/transaction';
import { storage, KEYS } from './storage';
import { format, parse } from 'date-fns';

export const TransactionService = {

  // ── Load ────────────────────────────────────────────────────────
  loadTransactions: (): Transaction[] => {
    return storage.get<Transaction[]>(KEYS.TRANSACTIONS, []) ?? [];
  },

  // ── Save ────────────────────────────────────────────────────────
  saveTransactions: (transactions: Transaction[]): void => {
    storage.set(KEYS.TRANSACTIONS, transactions);
  },

  // ── Add ─────────────────────────────────────────────────────────
  addTransaction: (transaction: Transaction): void => {
    const transactions = TransactionService.loadTransactions();
    transactions.push(transaction);
    TransactionService.saveTransactions(transactions);
  },

  // ── Update ──────────────────────────────────────────────────────
  updateTransaction: (updated: Transaction): boolean => {
    const transactions = TransactionService.loadTransactions();
    const index = transactions.findIndex(
      (t) => t.transactionId === updated.transactionId
    );
    if (index === -1) return false;
    transactions[index] = updated;
    TransactionService.saveTransactions(transactions);
    return true;
  },

  // ── Delete ──────────────────────────────────────────────────────
  deleteTransaction: (transactionId: number): boolean => {
    const transactions = TransactionService.loadTransactions();
    const filtered = transactions.filter(
      (t) => t.transactionId !== transactionId
    );
    if (filtered.length === transactions.length) return false;
    TransactionService.saveTransactions(filtered);
    return true;
  },

  // ── Filter by date ──────────────────────────────────────────────
  filterByDateRange: (
    transactions: Transaction[],
    startDate?: Date,
    endDate?: Date
  ): Transaction[] => {
    return transactions.filter((t) => {
      const date = new Date(t.date);
      const afterStart = !startDate || date >= new Date(
        startDate.getFullYear(), startDate.getMonth(), startDate.getDate()
      );
      const beforeEnd = !endDate || date <= new Date(
        endDate.getFullYear(), endDate.getMonth(), endDate.getDate()
      );
      return afterStart && beforeEnd;
    });
  },

  // ── Generate from income map (onboarding) ───────────────────────
  generateFromIncomeMap: (): Transaction[] => {
    const incomeMapRaw = storage.getString(KEYS.INCOME_MAP);
    const startDateStr = storage.getString(KEYS.START_DATE);
    const endDateStr = storage.getString(KEYS.END_DATE);

    if (!incomeMapRaw || !startDateStr || !endDateStr) return [];

    const incomeMap = JSON.parse(incomeMapRaw) as Record<string, Array<{ day: number; amount: string }>>;
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const transactions: Transaction[] = [];

    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= endDate) {
      Object.values(incomeMap).forEach((incomeList) => {
        incomeList.forEach((income) => {
          const day = income.day ?? 1;
          const txDate = new Date(current.getFullYear(), current.getMonth(), day);
          if (txDate > endDate) return;

          const amount = parseFloat(income.amount.replace(/\./g, '').replace(',', '.'));

          transactions.push(createTransaction({
            title: 'Maaş',
            amount,
            category: 'Gelir',
            subcategory: 'Maaş',
            date: txDate.toISOString(),
            isSurplus: true,
            currency: 'TRY',
            description: 'Income',
            isFromInvoice: false,
          }));
        });
      });
      current.setMonth(current.getMonth() + 1);
    }

    return transactions;
  },
};