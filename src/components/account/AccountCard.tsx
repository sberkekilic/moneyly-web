'use client';

import { Account, isCreditCard } from '@/models/account';
import { formatAmount } from '@/lib/formatters';
import { CreditCard, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const isCredit = isCreditCard(account);

  return (
    <div
      onClick={onClick}
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 cursor-pointer hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          isCredit ? 'bg-purple-100 dark:bg-purple-900' : 'bg-green-100 dark:bg-green-900'
        )}>
          {isCredit
            ? <CreditCard size={20} className="text-purple-600 dark:text-purple-400" />
            : <Wallet size={20} className="text-green-600 dark:text-green-400" />
          }
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {account.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{account.type}</p>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatAmount(account.balance ?? 0)} {account.currency}
          </p>
          {isCredit && (
            <>
              <p className="text-xs text-gray-500">
                Limit: {formatAmount(account.creditLimit ?? 0)}
              </p>
              <p className="text-xs text-red-500">
                Borç: {formatAmount(account.previousDebt ?? 0)}
              </p>
              <p className="text-xs text-orange-500">
                Min: {formatAmount(account.minPayment ?? 0)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}