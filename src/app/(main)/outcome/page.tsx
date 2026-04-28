// src/app/(main)/outcome/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTransactionStore } from '@/store/transactionStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Transaction } from '@/models/transaction';
import { formatAmount, formatDateShort } from '@/lib/formatters';
import {
  TrendingDown, Folder, Tag, Trash2, Plus,
  ArrowDownRight, Calendar, Shield, Receipt,
  Inbox, ArrowLeft, Wallet, BarChart3, ChevronRight, Pencil, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { AddTransactionModal } from '@/components/transaction/AddTransactionModal';
import { AuthGuard } from '@/components/AuthGuard';
import { EditTransactionModal } from '@/components/transaction/EditTransactionModal';
import {
  calculateCreditCardCycle,
  formatMonthYear,
  isDateInRangeInclusive,
  parseLocalDateInput,
  toDateInputValue,
} from '@/lib/creditCard';

const CATEGORY_COLORS = [
  '#3B82F6', '#F97316', '#14B8A6', '#8B5CF6',
  '#EF4444', '#22C55E', '#6366F1', '#EC4899',
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '₺', EUR: '€', USD: '$', GBP: '£',
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

function getTotalsByCurrency(transactions: Transaction[]): Record<string, number> {
  const totals: Record<string, number> = {};
  transactions.forEach((tx) => {
    const cur = tx.currency || 'TRY';
    totals[cur] = (totals[cur] ?? 0) + tx.amount;
  });
  return totals;
}

// ── helpers used by sub-components (no hooks, safe at module level) ──
function buildDateRangeDefaults() {
  const now = new Date();
  return {
    start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    end: toDateInputValue(now),
  };
}

export default function OutcomePage() {
  const { loadAllData, deleteTransaction, bankDataList } = useTransactionStore();
  const user = useAuthStore((s) => s.user);
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  const [selectedAccountRef, setSelectedAccountRef] = useState<{
    accountId: number;
    bankId: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // ── Date range state — INSIDE the component ──
  const defaults = buildDateRangeDefaults();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const t = {
    title:         lang === 'tr' ? 'Giderler' : 'Expenses',
    selectAccount: lang === 'tr' ? 'Hesap Seçin' : 'Select Account',
    accountType:   lang === 'tr' ? 'Hesap Türü' : 'Account Type',
    creditCard:    lang === 'tr' ? 'Kredi Kartı' : 'Credit Card',
    bankAccount:   lang === 'tr' ? 'Banka Hesabı' : 'Bank Account',
    txCount:       lang === 'tr' ? 'İşlem Sayısı' : 'Transaction Count',
    totalExpense:  lang === 'tr' ? 'Toplam Gider' : 'Total Expenses',
    noExpenses:    lang === 'tr' ? 'Bu hesapta henüz gider işlemi yok' : 'No expenses yet',
    catDist:       lang === 'tr' ? 'Kategori Dağılımı' : 'Category Distribution',
    transactions:  lang === 'tr' ? 'İşlemler' : 'Transactions',
    addTx:         lang === 'tr' ? 'İşlem Ekle' : 'Add Transaction',
    noAccount:     lang === 'tr' ? 'Hesap seçin' : 'Select an account',
    noAccountSub:  lang === 'tr' ? 'Yukarıdan bir hesap seçerek başlayın' : 'Choose an account above to start',
    noExpensesSub: lang === 'tr' ? '+ butonuyla yeni gider ekleyin' : 'Use the + button to add expenses',
    deleteAll:     lang === 'tr' ? 'Tüm taksitleri silmek ister misiniz?' : 'Delete all installments?',
    deleted:       lang === 'tr' ? 'İşlem silindi' : 'Transaction deleted',
    deleteFail:    lang === 'tr' ? 'Silme işlemi başarısız oldu' : 'Failed to delete',
    credit:        lang === 'tr' ? '(Kredi)' : '(Credit)',
    bank:          lang === 'tr' ? '(Banka)' : '(Bank)',
    topCategories: lang === 'tr' ? 'En Çok Harcanan' : 'Top Spending',
    tx:            lang === 'tr' ? 'işlem' : 'transactions',
    byCurrency:    lang === 'tr' ? 'Para Birimine Göre' : 'By Currency',
    period:        lang === 'tr' ? 'Dönem' : 'Period',
    dateRange:     lang === 'tr' ? 'Tarih Aralığı' : 'Date Range',
    reset:         lang === 'tr' ? 'Sıfırla' : 'Reset',
    statement:     lang === 'tr' ? 'Ekstre' : 'Statement',
    nextCutoff:    lang === 'tr' ? 'Sonraki Kesim' : 'Next Cutoff',
  };

  useEffect(() => {
    loadAllData().finally(() => setIsLoading(false));
  }, [user]);

  useEffect(() => {
    if (bankDataList.length > 0 && !selectedAccountRef) {
      const b = bankDataList[0];
      if (b?.accounts?.[0]) {
        setSelectedAccountRef({
          accountId: b.accounts[0].accountId,
          bankId: b.bankId,
        });
      }
    }
  }, [bankDataList]);

  // ── Resolve selectedAccount from ref ──
  const selectedAccount = (() => {
    if (!selectedAccountRef) return null;
    for (const bank of bankDataList) {
      if (bank.bankId === selectedAccountRef.bankId) {
        const acc = bank.accounts?.find(
          (a: any) => a.accountId === selectedAccountRef.accountId
        );
        if (acc) return { ...acc, bankId: bank.bankId, bankName: bank.bankName };
      }
    }
    return null;
  })();

  // ── Auto-set billing period when credit card selected ──
  useEffect(() => {
    if (!selectedAccount) return;
    if (selectedAccount.isDebit === false) {
      const cycle = calculateCreditCardCycle(selectedAccount.cutoffDate || 1);
      setStartDate(toDateInputValue(cycle.currentPeriodStart));
      setEndDate(toDateInputValue(cycle.currentPeriodEndInclusive));
    } else {
      const d = buildDateRangeDefaults();
      setStartDate(d.start);
      setEndDate(d.end);
    }
  }, [selectedAccount?.accountId, selectedAccount?.cutoffDate, selectedAccount?.isDebit]);

  // ── Cycle info for UI (only for credit cards) ──
  const selectedCycle =
    selectedAccount?.isDebit === false
      ? calculateCreditCardCycle(selectedAccount.cutoffDate || 1)
      : null;

  const isCreditCard = selectedAccount?.isDebit === false;

  const handleResetDates = () => {
    if (isCreditCard && selectedAccount) {
      const cycle = calculateCreditCardCycle(selectedAccount.cutoffDate || 1);
      setStartDate(toDateInputValue(cycle.currentPeriodStart));
      setEndDate(toDateInputValue(cycle.currentPeriodEndInclusive));
    } else {
      const d = buildDateRangeDefaults();
      setStartDate(d.start);
      setEndDate(d.end);
    }
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [bankIdStr, accountIdStr] = e.target.value.split('_');
    const accountId = Number(accountIdStr);
    for (const bank of bankDataList) {
      const found = bank.accounts?.find((a: any) => a.accountId === accountId);
      if (found) {
        setSelectedAccountRef({ accountId: found.accountId, bankId: bank.bankId });
        break;
      }
    }
  };

  const getAccountTransactions = (): Transaction[] => {
    const txs = selectedAccount?.transactions ?? [];
    // If no date range set, return all
    if (!startDate && !endDate) return txs;
    return txs.filter((tx) => {
      const d = parseLocalDateInput(tx.date);
      return isDateInRangeInclusive(d, startDate, endDate);
    });
  };

  const getGrouped = () => {
    const grouped: Record<string, Record<string, Transaction[]>> = {};
    getAccountTransactions().forEach((tx) => {
      if (tx.isSurplus) return;
      const cat = tx.category || 'Diğer';
      const sub = tx.subcategory || 'Diğer';
      if (!grouped[cat]) grouped[cat] = {};
      if (!grouped[cat][sub]) grouped[cat][sub] = [];
      grouped[cat][sub].push(tx);
    });
    return grouped;
  };

  const grouped = getGrouped();

  const allExpenseTxs: Transaction[] = Object.values(grouped).flatMap((subMap) =>
    Object.values(subMap).flat()
  );

  const totalsByCurrency = getTotalsByCurrency(allExpenseTxs);

  const primaryCurrency = Object.keys(totalsByCurrency).includes('TRY')
    ? 'TRY'
    : (Object.keys(totalsByCurrency)[0] ?? 'TRY');

  const topCategories = Object.entries(grouped)
    .map(([cat, subMap]) => ({
      name: cat,
      totalsByCurrency: getTotalsByCurrency(Object.values(subMap).flat()),
      count: Object.values(subMap).reduce((s, txs) => s + txs.length, 0),
    }))
    .sort((a, b) => (b.totalsByCurrency[primaryCurrency] ?? 0) - (a.totalsByCurrency[primaryCurrency] ?? 0))
    .slice(0, 5);

  const handleDelete = async (tx: Transaction) => {
    if (!selectedAccount) return;
    try {
      const choice = tx.installment && tx.installment > 1 ? confirm(t.deleteAll) : false;
      await deleteTransaction(
        selectedAccount.accountId,
        selectedAccount.bankId,
        tx.transactionId,
        choice
      );
      toast.success(t.deleted);
    } catch {
      toast.error(t.deleteFail);
    }
  };

  const handleEdit = (tx: Transaction) => setEditingTx(tx);

  const expenseCount = getAccountTransactions().filter((tx) => !tx.isSurplus).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/home" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t.addTx}</span>
            <span className="sm:hidden">{lang === 'tr' ? 'Ekle' : 'Add'}</span>
          </button>
        </div>

        {/* ── Top Row: Account + Total ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Account Selector */}
          {bankDataList.length > 0 && (
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={16} className="text-blue-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t.selectAccount}
                </span>
              </div>
              <select
                value={
                  selectedAccountRef
                    ? `${selectedAccountRef.bankId}_${selectedAccountRef.accountId}`
                    : ''
                }
                onChange={handleAccountChange}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t.selectAccount}...</option>
                {bankDataList.map((bank: any) =>
                  bank.accounts?.map((acc: any) => (
                    <option
                      key={`${bank.bankId}_${acc.accountId}`}
                      value={`${bank.bankId}_${acc.accountId}`}
                    >
                      {bank.bankName} — {acc.name}{' '}
                      {acc.isDebit === false ? t.credit : t.bank}
                    </option>
                  ))
                )}
              </select>

              {selectedAccount && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">{t.accountType}</p>
                    <p className={cn('text-xs font-bold', isCreditCard ? 'text-purple-600' : 'text-green-600')}>
                      {isCreditCard ? t.creditCard : t.bankAccount}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">{t.txCount}</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {expenseCount}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Total Card */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={18} className="text-red-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAccount
                      ? `${selectedAccount.name} — ${t.totalExpense}`
                      : t.totalExpense}
                  </span>
                </div>

                {Object.keys(totalsByCurrency).length === 0 ? (
                  <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {formatAmount(0)} ₺
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {Object.entries(totalsByCurrency).map(([currency, amount]) => (
                      <div key={currency} className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                          {formatAmount(amount)}
                        </p>
                        <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                          {getCurrencySymbol(currency)}
                        </span>
                        {Object.keys(totalsByCurrency).length > 1 && (
                          <span className="text-xs font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {currency}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {Object.keys(totalsByCurrency).length === 0 && selectedAccount && (
                  <p className="text-xs text-gray-400 mt-1">{t.noExpenses}</p>
                )}
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl flex-shrink-0 ml-4">
                <Receipt size={32} className="text-red-500" />
              </div>
            </div>

            {topCategories.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                <p className="text-xs font-semibold text-gray-400 mb-2">{t.topCategories}</p>
                <div className="flex flex-wrap gap-2">
                  {topCategories.map(({ name, totalsByCurrency: catCurrencies }, idx) => {
                    const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                    return (
                      <div
                        key={name}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{name}</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {Object.entries(catCurrencies)
                            .map(([cur, amt]) => `${formatAmount(amt)}${getCurrencySymbol(cur)}`)
                            .join(' + ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Date Range Filter ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {isCreditCard ? `${t.period} / ${t.dateRange}` : t.dateRange}
            </span>
          </div>

          {/* Credit card billing period chips */}
          {selectedCycle && (
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-xs font-semibold text-purple-600">
                {formatMonthYear(selectedCycle.currentPeriodStart, lang === 'tr' ? 'tr-TR' : 'en-US')} {t.period.toLowerCase()}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                {t.statement}: {toDateInputValue(selectedCycle.statementCutoffDate)} → {toDateInputValue(selectedCycle.statementDueDate)}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
                {t.nextCutoff}: {toDateInputValue(selectedCycle.nextCutoffDate)}
              </span>
            </div>
          )}

          {/* Date pickers */}
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
              onClick={handleResetDates}
              className="px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={t.reset}
            >
              <RefreshCw size={16} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* ── Category Distribution + Transaction Groups ── */}
        {Object.keys(grouped).length > 0 ? (
          <>
            <CategoryProgressBars
              grouped={grouped}
              primaryCurrency={primaryCurrency}
              t={t}
            />
            <TransactionGroups
              grouped={grouped}
              onDelete={handleDelete}
              onEdit={handleEdit}
              t={t}
            />
          </>
        ) : (
          <EmptyState hasAccount={!!selectedAccount} t={t} />
        )}

        {/* ── FAB ── */}
        <button
          onClick={() => setShowAddModal(true)}
          className="lg:hidden fixed bottom-24 right-4 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-3 rounded-2xl shadow-lg transition-all font-semibold text-sm z-40"
        >
          <Plus size={18} />
          {t.addTx}
        </button>

        {showAddModal && selectedAccount && (
          <AddTransactionModal
            accounts={bankDataList}
            selectedAccount={selectedAccount}
            isCreditCard={isCreditCard}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {editingTx && selectedAccount && (
          <EditTransactionModal
            transaction={editingTx}
            accountId={selectedAccount.accountId}
            bankId={selectedAccount.bankId}
            isCreditCard={isCreditCard}
            onClose={() => setEditingTx(null)}
          />
        )}
      </div>
    </AuthGuard>
  );
}

// ══════════════════════════════════════════════════════════
// SUB-COMPONENTS (no hooks that depend on page state)
// ══════════════════════════════════════════════════════════

function CategoryProgressBars({
  grouped,
  primaryCurrency,
  t,
}: {
  grouped: Record<string, Record<string, Transaction[]>>;
  primaryCurrency: string;
  t: any;
}) {
  const categories = Object.entries(grouped) as [string, Record<string, Transaction[]>][];
  const allTxs = categories.flatMap(([, subMap]) => Object.values(subMap).flat());
  const grandTotalsByCurrency = getTotalsByCurrency(allTxs);
  const primaryGrandTotal = grandTotalsByCurrency[primaryCurrency] ?? 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-blue-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t.catDist}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map(([cat, subMap], idx) => {
          const flatTxs = Object.values(subMap).flat();
          const catCurrencies = getTotalsByCurrency(flatTxs);
          const catPrimaryTotal = catCurrencies[primaryCurrency] ?? 0;
          const percent = primaryGrandTotal > 0 ? catPrimaryTotal / primaryGrandTotal : 0;
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          const txCount = flatTxs.length;

          return (
            <div key={cat} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{cat}</span>
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-lg"
                  style={{ color, backgroundColor: color + '15' }}
                >
                  %{(percent * 100).toFixed(0)}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(percent * 100).toFixed(0)}%`, backgroundColor: color }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{txCount} {t.tx}</span>
                <div className="flex flex-col items-end gap-0.5">
                  {Object.entries(catCurrencies).map(([cur, amt]) => (
                    <span key={cur} className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {formatAmount(amt)}{getCurrencySymbol(cur)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransactionGroups({
  grouped,
  onDelete,
  onEdit,
  t,
}: {
  grouped: Record<string, Record<string, Transaction[]>>;
  onDelete: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  t: any;
}) {
  const categoryKeys = Object.keys(grouped);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(categoryKeys.map((k) => [k, true]))
  );
  const [expandedSub, setExpandedSub] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.entries(grouped).forEach(([cat, subMap]) => {
      Object.keys(subMap).forEach((sub) => { initial[`${cat}_${sub}`] = true; });
    });
    return initial;
  });

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      Object.keys(grouped).forEach((k) => { if (next[k] === undefined) next[k] = true; });
      return next;
    });
    setExpandedSub((prev) => {
      const next = { ...prev };
      Object.entries(grouped).forEach(([cat, subMap]) => {
        Object.keys(subMap).forEach((sub) => {
          const key = `${cat}_${sub}`;
          if (next[key] === undefined) next[key] = true;
        });
      });
      return next;
    });
  }, [grouped]);

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
        {t.transactions}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(grouped).map(([cat, subMap]) => {
          const catIdx = Object.keys(grouped).indexOf(cat);
          const color = CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length];
          const flatTxs = Object.values(subMap).flat();
          const txCount = flatTxs.length;
          const catCurrencies = getTotalsByCurrency(flatTxs);
          const isOpen = expanded[cat] ?? true;

          const catSummary = Object.entries(catCurrencies)
            .map(([cur, amt]) => `${formatAmount(amt)}${getCurrencySymbol(cur)}`)
            .join(' + ');

          return (
            <div
              key={cat}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <button
                onClick={() => setExpanded((p) => ({ ...p, [cat]: !p[cat] }))}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: color + '15' }}
                >
                  <Folder size={18} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{cat}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {txCount} {t.tx} · {catSummary}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className={cn('text-gray-400 transition-transform duration-200 flex-shrink-0', isOpen && 'rotate-90')}
                />
              </button>

              {isOpen && Object.entries(subMap).map(([sub, txs]) => {
                const subKey = `${cat}_${sub}`;
                const isSubOpen = expandedSub[subKey] ?? true;
                const subCurrencies = getTotalsByCurrency(txs);
                const subSummary = Object.entries(subCurrencies)
                  .map(([cur, amt]) => `${formatAmount(amt)}${getCurrencySymbol(cur)}`)
                  .join(' + ');

                return (
                  <div key={sub} className="border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => setExpandedSub((p) => ({ ...p, [subKey]: !p[subKey] }))}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <Tag size={14} className="text-blue-500 ml-4 flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{sub}</span>
                      <span className="text-xs text-gray-500 mr-1">{txs.length} · {subSummary}</span>
                      <ChevronRight
                        size={14}
                        className={cn('text-gray-400 transition-transform duration-200 flex-shrink-0', isSubOpen && 'rotate-90')}
                      />
                    </button>

                    {isSubOpen && txs
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((tx) => (
                        <TransactionTile key={tx.transactionId} tx={tx} onDelete={onDelete} onEdit={onEdit} />
                      ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransactionTile({
  tx,
  onDelete,
  onEdit,
}: {
  tx: Transaction;
  onDelete: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/20 hover:bg-gray-100/50 dark:hover:bg-gray-600/20 transition-colors group">
      <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
        <ArrowDownRight size={14} className="text-red-500" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{tx.title}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="flex items-center gap-1">
            <Calendar size={10} className="text-gray-400" />
            <span className="text-[10px] text-gray-400">{formatDateShort(tx.date)}</span>
          </span>
          {tx.installment && tx.installment > 1 && (
            <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
              {tx.currentInstallment ?? 1}/{tx.installment}
            </span>
          )}
          {tx.isProvisioned && (
            <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
              <Shield size={10} />
              <span className="hidden sm:inline">Provizyon</span>
            </span>
          )}
        </div>
      </div>

      <p className="text-sm font-bold text-red-500 flex-shrink-0 tabular-nums">
        {formatAmount(tx.amount)} {getCurrencySymbol(tx.currency || 'TRY')}
      </p>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(tx)}
          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
          title="Düzenle"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(tx)}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
          title="Sil"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ hasAccount, t }: { hasAccount: boolean; t: any }) {
  return (
    <div className="flex flex-col items-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4">
        <Inbox size={32} className="text-gray-300 dark:text-gray-500" />
      </div>
      <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-1">
        {hasAccount ? t.noExpenses : t.noAccount}
      </p>
      <p className="text-sm text-gray-400">
        {hasAccount ? t.noExpensesSub : t.noAccountSub}
      </p>
    </div>
  );
}