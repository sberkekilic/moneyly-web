// ============================================
// INCOME SERVICE
// Converted from: lib/services/income_storage_service.dart
// ============================================

import { Income } from '@/models/income';
import { storage, KEYS } from './storage';

export type IncomeSummary = {
  work: number;
  scholarship: number;
  pension: number;
  total: number;
  lastUpdated: string;
};

export const IncomeService = {

  loadIncomes: (): Income[] => {
    return storage.get<Income[]>(KEYS.INCOMES, []) ?? [];
  },

  saveIncomes: (incomes: Income[]): void => {
    storage.set(KEYS.INCOMES, incomes);
    IncomeService._updateSummary(incomes);
  },

  addIncome: (income: Income): void => {
    const incomes = IncomeService.loadIncomes();
    incomes.push(income);
    IncomeService.saveIncomes(incomes);
  },

  deleteIncome: (incomeId: number): void => {
    const incomes = IncomeService.loadIncomes().filter(
      (i) => i.incomeId !== incomeId
    );
    IncomeService.saveIncomes(incomes);
  },

  getByAccountId: (accountId: number): Income[] =>
    IncomeService.loadIncomes().filter((i) => i.accountId === accountId),

  getBySource: (source: string): Income[] =>
    IncomeService.loadIncomes().filter((i) => i.source === source),

  getTotalIncome: (): number =>
    IncomeService.loadIncomes().reduce((sum, i) => sum + i.amount, 0),

  getByDateRange: (start: Date, end: Date): Income[] =>
    IncomeService.loadIncomes().filter((i) => {
      const d = new Date(i.date);
      return d >= start && d <= end;
    }),

  getMonthlyBreakdown: (): Record<string, number> => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthly = IncomeService.getByDateRange(start, end);
    const breakdown: Record<string, number> = {
      work: 0, scholarship: 0, pension: 0, total: 0,
    };
    monthly.forEach((i) => {
      breakdown.total += i.amount;
      if (i.source === 'İş') breakdown.work += i.amount;
      else if (i.source === 'Burs') breakdown.scholarship += i.amount;
      else if (i.source === 'Emekli') breakdown.pension += i.amount;
    });
    return breakdown;
  },

  getSummary: (): IncomeSummary => {
    return storage.get<IncomeSummary>(KEYS.INCOME_SUMMARY, {
      work: 0, scholarship: 0, pension: 0, total: 0,
      lastUpdated: new Date().toISOString(),
    })!;
  },

  _updateSummary: (incomes: Income[]): void => {
    const summary: IncomeSummary = {
      work: 0, scholarship: 0, pension: 0, total: 0,
      lastUpdated: new Date().toISOString(),
    };
    incomes.forEach((i) => {
      summary.total += i.amount;
      if (i.source === 'İş') summary.work += i.amount;
      else if (i.source === 'Burs') summary.scholarship += i.amount;
      else if (i.source === 'Emekli') summary.pension += i.amount;
    });
    storage.set(KEYS.INCOME_SUMMARY, summary);
  },
};