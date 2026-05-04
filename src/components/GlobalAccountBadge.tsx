// components/GlobalAccountBadge.tsx
'use client';
import { useAccountStore } from '@/store/accountStore';
import { useTransactionStore } from '@/store/transactionStore';
import { CreditCard, Wallet, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/formatters';
import { useState, useRef, useEffect } from 'react';

export function GlobalAccountBadge() {
  const { selectedAccount, setSelectedAccount } = useAccountStore();
  const { bankDataList } = useTransactionStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allAccounts = bankDataList.flatMap((bank: any) =>
    (bank.accounts ?? []).map((acc: any) => ({
      ...acc, bankId: bank.bankId, bankName: bank.bankName,
    }))
  );

  const isCreditCard = selectedAccount?.isDebit === false;

  if (!selectedAccount) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
          isCreditCard
            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
        )}
      >
        {isCreditCard ? <CreditCard size={12} /> : <Wallet size={12} />}
        <span className="max-w-[100px] truncate hidden sm:block">{selectedAccount.name}</span>
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 
                        rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 
                        overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2 py-1">
              Hesap Seç
            </p>
          </div>
          <div className="p-2 max-h-60 overflow-y-auto">
            {allAccounts.map((acc) => {
              const isSelected = selectedAccount?.accountId === acc.accountId;
              const isCC = acc.isDebit === false;
              return (
                <button
                  key={acc.accountId}
                  onClick={() => { setSelectedAccount(acc); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                    isCC
                      ? 'bg-purple-100 dark:bg-purple-900/30'
                      : 'bg-green-100 dark:bg-green-900/30'
                  )}>
                    {isCC
                      ? <CreditCard size={13} className="text-purple-600" />
                      : <Wallet size={13} className="text-green-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {acc.name}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{acc.bankName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn(
                      'text-xs font-bold tabular-nums',
                      isCC ? 'text-red-500' : 'text-green-600'
                    )}>
                      {isCC
                        ? `${formatAmount(acc.totalDebt ?? 0)}₺`
                        : `${formatAmount(acc.balance ?? 0)}₺`
                      }
                    </p>
                    {isSelected && (
                      <span className="text-[9px] text-blue-500 font-bold">● Seçili</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}