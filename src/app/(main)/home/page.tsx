// src/app/(main)/home/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTransactionStore } from '@/store/transactionStore';
import { useIncomeStore } from '@/store/incomeStore';
import { TransactionCard } from '@/components/transaction/TransactionCard';
import { formatAmount } from '@/lib/formatters';
import {
  TrendingUp, TrendingDown, Wallet, Calendar, RefreshCw,
  ArrowUpRight, ArrowDownRight, BarChart3, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { UpcomingPayments } from '@/components/UpcomingPayments';
import { DebtPaymentTracker } from '@/components/home/DebtPaymentTracker';
import {
  calculateCreditCardCycle,
  formatMonthYear,
  toDateInputValue,
} from '@/lib/creditCard';

// ── Currency helpers ──────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '₺', EUR: '€', USD: '$', GBP: '£',
};
function sym(currency: string) {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** Groups transaction amounts by currency → { TRY: 1500, EUR: 200 } */
function totalsByCurrency(txs: any[]): Record<string, number> {
  return txs.reduce<Record<string, number>>((acc, t) => {
    const c = t.currency || 'TRY';
    acc[c] = (acc[c] ?? 0) + t.amount;
    return acc;
  }, {});
}

/** Renders "1.500 ₺ + 200 €" — or just "0 ₺" when empty */
function CurrencyTotals({
  totals,
  colorClass,
}: {
  totals: Record<string, number>;
  colorClass: string;
}) {
  const entries = Object.entries(totals);
  if (entries.length === 0) {
    return (
      <p className={cn('text-2xl font-bold', colorClass)}>
        {formatAmount(0)} ₺
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(([currency, amount]) => (
        <p key={currency} className={cn('text-2xl font-bold leading-tight', colorClass)}>
          {formatAmount(amount)}{' '}
          <span className="text-lg">{sym(currency)}</span>
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────

export default function HomePage() {
  const { transactions, loadAllData, bankDataList } = useTransactionStore();
  const { incomes, loadIncomes, getTotalIncome } = useIncomeStore();
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const now = new Date();
  const [startDate, setStartDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  );
  const [endDate, setEndDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
  const [isDebtVisible, setIsDebtVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllData().then(() => loadIncomes()).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (bankDataList.length > 0 && !selectedAccount) {
      const b = bankDataList[0];
      if (b?.accounts?.[0])
        setSelectedAccount({ ...b.accounts[0], bankId: b.bankId, bankName: b.bankName });
    }
  }, [bankDataList]);

  useEffect(() => {
    if (selectedAccount?.isDebit === false) {
      const cycle = calculateCreditCardCycle(selectedAccount.cutoffDate || 1);
      setStartDate(toDateInputValue(cycle.currentPeriodStart));
      setEndDate(toDateInputValue(cycle.currentPeriodEndInclusive));
    }
  }, [selectedAccount?.accountId, selectedAccount?.cutoffDate, selectedAccount?.isDebit]);

  const selectedCycle =
    selectedAccount?.isDebit === false
      ? calculateCreditCardCycle(selectedAccount.cutoffDate || 1)
      : null;

  // ── Filtering ──
  const filtered = transactions.filter((t) => {
    const d = new Date(t.date);
    if (startDate && d < new Date(startDate)) return false;
    if (endDate && d > new Date(endDate)) return false;
    return true;
  });

  const expenseTxs = filtered.filter((t) => !t.isSurplus);

  // Currency-split totals
  const expenseTotals = totalsByCurrency(expenseTxs);

  // For net profit we still use the TRY-only total (income is always TRY in your store)
  const totalIncome = getTotalIncome();
  const totalExpenseTRY = expenseTotals['TRY'] ?? 0;
  const netProfit = totalIncome - totalExpenseTRY;
  const hasMultiCurrency = Object.keys(expenseTotals).length > 1;

  const recentExpenses = [...expenseTxs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const incomeTxList = incomes.slice(0, 15).map((i) => ({
    transactionId: i.incomeId,
    title: i.source,
    amount: i.amount,
    currency: i.currency || 'TRY',
    date: i.date,
    category: 'Gelir',
    subcategory: i.source,
    isSurplus: true,
    description: i.description || '',
    isFromInvoice: false,
    isProvisioned: false,
  }));

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );

  return (
    <AuthGuard>
      <div className="space-y-6">
        {/* ── Metric Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Income — always single currency */}
          <MetricCard
            label="Toplam Gelir"
            amount={totalIncome}
            icon={<TrendingUp size={20} />}
            trend={<ArrowUpRight size={14} />}
            color="green"
          />

          {/* Expense — currency-aware */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Toplam Gider</p>
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-500">
                <TrendingDown size={20} />
              </div>
            </div>
            <CurrencyTotals totals={expenseTotals} colorClass="text-red-500" />
            {hasMultiCurrency && (
              <p className="text-[10px] text-gray-400 mt-1">
                Birden fazla para birimi
              </p>
            )}
          </div>

          {/* Net */}
          <MetricCard
            label={hasMultiCurrency ? 'Net (₺ bazlı)' : 'Net Kar/Zarar'}
            amount={netProfit}
            icon={<Wallet size={20} />}
            color={netProfit >= 0 ? 'blue' : 'orange'}
          />
        </div>

        {/* ── Date Range + Quick Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-blue-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Tarih Aralığı
              </span>
            </div>

            {/* Date inputs row */}
            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 min-w-[140px] bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 min-w-[140px] bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <RefreshCw size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Billing period info — only shown for credit cards, BELOW inputs */}
            {selectedCycle && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-xs font-semibold text-blue-600">
                  {formatMonthYear(selectedCycle.currentPeriodStart, 'tr-TR')} dönemi
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                  Ekstre: {toDateInputValue(selectedCycle.statementCutoffDate)} → {toDateInputValue(selectedCycle.statementDueDate)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                  Sonraki Kesim: {toDateInputValue(selectedCycle.nextCutoffDate)}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                  Sonraki Son Ödeme: {toDateInputValue(selectedCycle.nextDueDate)}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Hızlı İşlemler
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Gelir Ekle', href: '/income', color: 'bg-green-50 dark:bg-green-900/20 text-green-600', icon: <TrendingUp size={16} /> },
                { label: 'Gider Ekle', href: '/outcome', color: 'bg-red-50 dark:bg-red-900/20 text-red-500', icon: <TrendingDown size={16} /> },
                { label: 'Yatırım', href: '/investment', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500', icon: <BarChart3 size={16} /> },
                { label: 'Hesaplar', href: '/account', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-500', icon: <CreditCard size={16} /> },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={cn('flex items-center gap-2 rounded-xl p-3 text-xs font-semibold transition-all hover:shadow-md', a.color)}
                >
                  {a.icon} {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Transaction Lists ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TxList
            title="Son Gelirler"
            icon={<TrendingUp size={16} className="text-green-600" />}
            txs={incomeTxList}
            emptyText="Gelir işlemi yok"
          />
          <TxList
            title="Son Giderler"
            icon={<TrendingDown size={16} className="text-red-500" />}
            txs={recentExpenses.slice(0, 15)}
            emptyText="Gider işlemi yok"
          />
        </div>

        <DebtPaymentTracker
          bankDataList={bankDataList}
          isVisible={isDebtVisible}
          onToggleVisibility={() => setIsDebtVisible(!isDebtVisible)}
        />
        <UpcomingPayments />
      </div>
    </AuthGuard>
  );
}

// ── MetricCard ────────────────────────────────────────────

function MetricCard({ label, amount, icon, color, trend }: any) {
  const m: any = {
    green:  { bg: 'bg-green-50 dark:bg-green-900/10',  text: 'text-green-600',  iconBg: 'bg-green-100 dark:bg-green-900/30'  },
    red:    { bg: 'bg-red-50 dark:bg-red-900/10',      text: 'text-red-500',    iconBg: 'bg-red-100 dark:bg-red-900/30'      },
    blue:   { bg: 'bg-blue-50 dark:bg-blue-900/10',    text: 'text-blue-600',   iconBg: 'bg-blue-100 dark:bg-blue-900/30'    },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/10',text: 'text-orange-500', iconBg: 'bg-orange-100 dark:bg-orange-900/30'},
  };
  const c = m[color] || m.blue;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className={cn('p-2 rounded-xl', c.iconBg, c.text)}>{icon}</div>
      </div>
      <p className={cn('text-2xl font-bold', c.text)}>
        {formatAmount(Math.abs(amount))} ₺
      </p>
    </div>
  );
}

// ── TxList ────────────────────────────────────────────────

function TxList({ title, icon, txs, emptyText }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">{title}</h2>
        </div>
        <span className="text-xs text-gray-400">{txs.length} işlem</span>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {txs.length === 0
          ? <p className="text-sm text-gray-400 text-center py-8">{emptyText}</p>
          : txs.map((t: any) => <TransactionCard key={t.transactionId} transaction={t} />)}
      </div>
    </div>
  );
}