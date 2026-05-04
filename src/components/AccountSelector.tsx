// components/AccountSelector.tsx
'use client';
import { useAccountStore } from '@/store/accountStore';
import { useTransactionStore } from '@/store/transactionStore';
import { CreditCard, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  showLabel?: boolean;
  filterType?: 'all' | 'debit' | 'credit';
}

export function AccountSelector({ className, showLabel = true, filterType = 'all' }: Props) {
  const { bankDataList } = useTransactionStore();
  const { selectedAccount, setSelectedAccount } = useAccountStore();

  const allAccounts = bankDataList.flatMap((bank: any) =>
    (bank.accounts ?? []).map((acc: any) => ({
      ...acc,
      bankId: bank.bankId,
      bankName: bank.bankName,
    }))
  );

  const filtered = allAccounts.filter((acc) => {
    if (filterType === 'debit') return acc.isDebit !== false;
    if (filterType === 'credit') return acc.isDebit === false;
    return true;
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) { setSelectedAccount(null); return; }
    const [bankIdStr, accountIdStr] = val.split('_');
    const found = filtered.find(
      (a) => a.accountId === Number(accountIdStr) && a.bankId === Number(bankIdStr)
    );
    if (found) setSelectedAccount(found);
  };

  const isCreditCard = selectedAccount?.isDebit === false;

  return (
    <div className={cn('space-y-2', className)}>
      {showLabel && (
        <div className="flex items-center gap-2">
          {isCreditCard
            ? <CreditCard size={14} className="text-purple-500" />
            : <Wallet size={14} className="text-green-500" />
          }
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Aktif Hesap
          </span>
        </div>
      )}
      <select
        value={
          selectedAccount
            ? `${selectedAccount.bankId}_${selectedAccount.accountId}`
            : ''
        }
        onChange={handleChange}
        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 
                   rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white 
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Hesap seçin...</option>
        {bankDataList.map((bank: any) =>
          bank.accounts
            ?.filter((acc: any) => {
              if (filterType === 'debit') return acc.isDebit !== false;
              if (filterType === 'credit') return acc.isDebit === false;
              return true;
            })
            .map((acc: any) => (
              <option key={acc.accountId} value={`${bank.bankId}_${acc.accountId}`}>
                {acc.isDebit === false ? '💳' : '🏦'} {bank.bankName} — {acc.name}
              </option>
            ))
        )}
      </select>

      {/* Selected account badge */}
      {selectedAccount && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium',
          isCreditCard
            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
        )}>
          {isCreditCard
            ? <CreditCard size={12} />
            : <Wallet size={12} />
          }
          <span className="truncate">
            {selectedAccount.bankName} — {selectedAccount.name}
          </span>
          <span className="ml-auto font-bold tabular-nums shrink-0">
            {selectedAccount.isDebit === false
              ? `${selectedAccount.totalDebt ?? 0}₺ borç`
              : `${selectedAccount.balance ?? 0}₺`
            }
          </span>
        </div>
      )}
    </div>
  );
}