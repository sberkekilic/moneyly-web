'use client';

import { useMemo, useState } from 'react';
import { useTransactionStore } from '@/store/transactionStore';
import { useIncomeStore } from '@/store/incomeStore';
import {
  CreditCard, Calendar, Clock, Wallet, TrendingUp,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { formatAmount, formatDateShort } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  calculateCreditCardCycle,
  parseLocalDateInput,
} from '@/lib/creditCard';

export function UpcomingPayments() {
  const { bankDataList, transactions } = useTransactionStore();
  const { incomes } = useIncomeStore();
  const [expanded, setExpanded] = useState(false);

  const upcoming = useMemo(() => {
    const now = parseLocalDateInput(new Date());
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const payments: any[] = [];

    // 1) Actual future installment transactions
    transactions
      .filter((t) => t.installment && t.installment > 1 && !t.isSurplus)
      .forEach((txn) => {
        const dueDate = parseLocalDateInput(txn.date);
        if (dueDate >= now && dueDate <= thirtyDaysLater) {
          payments.push({
            id: `inst_${txn.transactionId}`,
            title: txn.title,
            category: txn.category,
            dueDate,
            amount: txn.amount,
            currency: txn.currency || 'TRY',
            type: 'installment',
            status: 'pending',
            installmentNumber: txn.currentInstallment,
            totalInstallments: txn.installment,
            daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / 86400000),
          });
        }
      });

    // 2) Recurring incomes
    incomes
      .filter((i) => i.isRecurring && i.day)
      .forEach((income) => {
        const today = now.getDate();
        const incomeDay = income.day!;
        let dueDate = new Date(now.getFullYear(), now.getMonth(), incomeDay, 12, 0, 0);

        if (incomeDay <= today) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        if (dueDate <= thirtyDaysLater) {
          payments.push({
            id: `income_${income.incomeId}`,
            title: `${income.source} Geliri`,
            category: 'Gelir',
            dueDate,
            amount: income.amount,
            currency: income.currency || 'TRY',
            type: 'recurringIncome',
            status: 'pending',
            accountName: income.accountName,
            daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / 86400000),
          });
        }
      });

    // 3) Credit card statement payments (hide if already paid)
    bankDataList.forEach((bank: any) => {
      (bank.accounts || [])
        .filter((a: any) => a.isDebit === false)
        .forEach((acc: any) => {
          const cycle = calculateCreditCardCycle(acc.cutoffDate || 1, now);
          const dueDate = cycle.statementDueDate;
          const statementDebt = acc.previousDebt || 0;
          const minPayment = acc.minPayment || 0;

          if (statementDebt > 0 && dueDate >= now && dueDate <= thirtyDaysLater) {
            payments.push({
              id: `${acc.accountId}_cc_statement`,
              title: `${acc.name} Ekstre Ödemesi`,
              category: 'Kredi Kartı',
              dueDate,
              amount: statementDebt,
              minPayment,
              currency: acc.currency || 'TRY',
              type: 'creditCardStatement',
              status: 'pending',
              accountName: `${bank.bankName} - ${acc.name}`,
              daysUntilDue: Math.ceil((dueDate.getTime() - now.getTime()) / 86400000),
            });
          }
        });
    });

    return payments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [transactions, incomes, bankDataList]);

  if (upcoming.length === 0) return null;

  const shownPayments = expanded ? upcoming : upcoming.slice(0, 3);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-blue-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Yaklaşan Ödemeler (30 gün)
          </h2>
        </div>
        <span className="text-xs text-gray-400">{upcoming.length} ödeme</span>
      </div>

      <div className="space-y-2">
        {shownPayments.map((p: any) => (
          <div
            key={p.id}
            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
          >
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                p.type === 'recurringIncome'
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : p.type === 'creditCardStatement'
                    ? 'bg-orange-100 dark:bg-orange-900/30'
                    : 'bg-purple-100 dark:bg-purple-900/30'
              )}
            >
              {p.type === 'recurringIncome' ? (
                <TrendingUp size={16} className="text-green-600" />
              ) : p.type === 'creditCardStatement' ? (
                <CreditCard size={16} className="text-orange-600" />
              ) : (
                <Wallet size={16} className="text-purple-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                {p.title}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <Clock size={10} className="text-gray-400" />
                <span
                  className={cn(
                    'text-[10px]',
                    p.daysUntilDue <= 3 ? 'text-red-500 font-semibold' : 'text-gray-400'
                  )}
                >
                  {p.daysUntilDue === 0 ? 'Bugün' : `${p.daysUntilDue} gün kaldı`}
                </span>

                <span className="text-[10px] text-gray-400">
                  {formatDateShort(p.dueDate)}
                </span>

                {p.installmentNumber && (
                  <span className="text-[10px] text-purple-500">
                    {p.installmentNumber}/{p.totalInstallments}
                  </span>
                )}

                {p.type === 'creditCardStatement' && p.minPayment > 0 && (
                  <span className="text-[10px] text-orange-500">
                    Asgari: {formatAmount(p.minPayment)} {p.currency}
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm font-bold text-gray-900 dark:text-white flex-shrink-0">
              {formatAmount(p.amount)} {p.currency}
            </p>
          </div>
        ))}
      </div>

      {upcoming.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 flex items-center justify-center gap-1 py-2 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Daralt' : `${upcoming.length - 3} ödeme daha göster`}
        </button>
      )}
    </div>
  );
}