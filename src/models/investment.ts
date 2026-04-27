// ============================================
// INVESTMENT MODEL
// Converted from: lib/models/investment_models.dart
// ============================================

export type InvestmentCategory = 'Döviz' | 'Altın' | 'Hisse' | 'Gayrimenkul' | 'Araç' | 'Elektronik' | string;

export interface Investment {
  id: number;
  category: InvestmentCategory;
  currency: string;
  name: string;
  deadline?: string;  // ISO string
  amount: string;
}

export interface InvestmentModel {
  id: number;
  aim: number;
  amount: number;
}

export const createInvestment = (
  partial: Partial<Investment> & Pick<Investment, 'name' | 'category'>
): Investment => {
  const { name, category, ...rest } = partial;

  return {
    id: Date.now(),
    category,
    currency: 'TRY',
    name,
    amount: '0',
    ...rest,
  };
};