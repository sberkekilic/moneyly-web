// ============================================
// INCOME MODEL
// Converted from: lib/models/income_model.dart
// ============================================

export type IncomeSource = 'İş' | 'Burs' | 'Emekli' | string;

export interface Income {
  incomeId: number;
  accountId: number;
  accountName: string;
  source: IncomeSource;
  amount: number;
  date: string;
  currency: string;
  description?: string;
  isRecurring: boolean;
  day?: number;
}

export const createIncome = (
  partial: Partial<Income> & Pick<Income, 'source' | 'amount' | 'accountId'>
): Income => {
  // ── Destructure required fields to avoid duplicate key warning ──
  const { source, amount, accountId, ...rest } = partial;

  return {
    // Required fields first
    incomeId:    Date.now(),
    accountId,
    accountName: '',
    source,
    amount,
    date:        new Date().toISOString(),
    currency:    'TRY',
    description: '',
    isRecurring: false,
    day:         undefined,
    // Spread the rest (optional overrides like accountName, currency, etc.)
    ...rest,
  };
};

export const copyIncome = (
  i: Income,
  overrides: Partial<Income>
): Income => ({ ...i, ...overrides });