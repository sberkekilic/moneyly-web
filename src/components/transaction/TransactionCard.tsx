// ============================================
// TRANSACTION CARD
// Converts: TransactionCard widget in transaction.dart
// ============================================

'use client';

import { Transaction, getCurrentInstallmentPeriod } from '@/models/transaction';
import { formatDay, formatMonthYear, formatAmount } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
}

export function TransactionCard({ transaction, onClick }: TransactionCardProps) {
  const amountColor = transaction.isSurplus
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-500 dark:text-red-400';

  const bgColor = transaction.isFromInvoice
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  const period = getCurrentInstallmentPeriod(transaction);

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all',
        bgColor
      )}
    >
      <div className="flex items-center gap-4">
        {/* Date */}
        <div className="flex flex-col items-center min-w-[40px]">
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {formatDay(transaction.date)}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {formatMonthYear(transaction.date)}
          </span>
        </div>

        {/* Title & Description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {transaction.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {transaction.description}
          </p>
        </div>

        {/* Amount */}
        <div className="flex flex-col items-end">
          <span className={cn('text-sm font-medium', amountColor)}>
            {formatAmount(transaction.amount)} {transaction.currency}
          </span>
          {period && (
            <span className="text-xs text-gray-400">{period}</span>
          )}
        </div>
      </div>
    </div>
  );
}