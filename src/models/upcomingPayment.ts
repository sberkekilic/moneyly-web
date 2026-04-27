export interface UpcomingPayment {
  id: string;
  title: string;
  category: string;
  dueDate: Date;
  amount: number;
  currency: string;
  type: 'installment' | 'normal' | 'creditCardMin' | 'creditCardFull' | 'recurringIncome';
  status: 'pending' | 'overdue';
  accountName?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  daysUntilDue: number;
}