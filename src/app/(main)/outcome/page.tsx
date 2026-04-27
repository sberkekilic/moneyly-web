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
  Inbox, ArrowLeft, Wallet, BarChart3, ChevronRight, Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { AddTransactionModal } from '@/components/transaction/AddTransactionModal';
import { AuthGuard } from '@/components/AuthGuard';
import { EditTransactionModal } from '@/components/transaction/EditTransactionModal';

const CATEGORY_COLORS = [
  '#3B82F6', '#F97316', '#14B8A6', '#8B5CF6',
  '#EF4444', '#22C55E', '#6366F1', '#EC4899',
];

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

  // ── Translations ──
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

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [bankIdStr, accountIdStr] = e.target.value.split('_');
    const bankId = Number(bankIdStr);
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
    return selectedAccount?.transactions ?? [];
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
  const totalAmount = Object.values(grouped).reduce(
    (total, subMap) =>
      total +
      Object.values(subMap).reduce(
        (s, txs) => s + txs.reduce((st, tx) => st + tx.amount, 0),
        0
      ),
    0
  );

  // Top categories for summary
  const topCategories = Object.entries(grouped)
    .map(([cat, subMap]) => ({
      name: cat,
      total: Object.values(subMap).reduce((s, txs) => s + txs.reduce((st, tx) => st + tx.amount, 0), 0),
      count: Object.values(subMap).reduce((s, txs) => s + txs.length, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const handleDelete = async (tx: Transaction) => {
    if (!selectedAccount) return;
    try {
      const choice =
        tx.installment && tx.installment > 1
          ? confirm(t.deleteAll)
          : false;
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

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
  };

  const isCreditCard = selectedAccount?.isDebit === false;
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
                    <p className={cn(
                      'text-xs font-bold',
                      isCreditCard ? 'text-purple-600' : 'text-green-600'
                    )}>
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={18} className="text-red-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAccount ? `${selectedAccount.name} — ${t.totalExpense}` : t.totalExpense}
                  </span>
                </div>
                <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {formatAmount(totalAmount)} ₺
                </p>
                {totalAmount === 0 && selectedAccount && (
                  <p className="text-xs text-gray-400 mt-1">{t.noExpenses}</p>
                )}
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl">
                <Receipt size={32} className="text-red-500" />
              </div>
            </div>

            {topCategories.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                <p className="text-xs font-semibold text-gray-400 mb-2">{t.topCategories}</p>
                <div className="flex flex-wrap gap-2">
                  {topCategories.map(({ name, total }, idx) => {
                    const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                    return (
                      <div
                        key={name}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{name}</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {formatAmount(total)}₺
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Category Distribution + Transaction Groups ── */}
        {Object.keys(grouped).length > 0 ? (
          <>
            {/* Category Progress Bars — 2 columns on desktop */}
            <CategoryProgressBars grouped={grouped} totalAmount={totalAmount} t={t} />

            {/* Transaction Groups */}
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

        {/* ── FAB — mobile only (desktop has inline button in header) ── */}
        <button
          onClick={() => setShowAddModal(true)}
          className="lg:hidden fixed bottom-24 right-4 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-3 rounded-2xl shadow-lg transition-all font-semibold text-sm z-40"
        >
          <Plus size={18} />
          {t.addTx}
        </button>

        {/* ── Add Modal ── */}
        {showAddModal && selectedAccount && (
          <AddTransactionModal
            accounts={bankDataList}
            selectedAccount={selectedAccount}
            isCreditCard={isCreditCard}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {/* ── Edit Modal — simplified onClose ── */}
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
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════

// ── Category Progress Bars ────────────────────────────────

function CategoryProgressBars({
  grouped,
  totalAmount,
  t,
}: {
  grouped: any;
  totalAmount: number;
  t: any;
}) {
  const categories = Object.entries(grouped) as [string, Record<string, Transaction[]>][];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-blue-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t.catDist}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map(([cat, subMap], idx) => {
          const catTotal = Object.values(subMap).reduce(
            (s, txs) => s + txs.reduce((st, tx) => st + tx.amount, 0), 0
          );
          const percent = totalAmount > 0 ? catTotal / totalAmount : 0;
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          const txCount = Object.values(subMap).reduce((s, txs) => s + txs.length, 0);

          return (
            <div
              key={cat}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2"
            >
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
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {formatAmount(catTotal)} ₺
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Transaction Groups ────────────────────────────────────

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
  // ── FIX: Initialize ALL categories as open ──
  const categoryKeys = Object.keys(grouped);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(categoryKeys.map((k) => [k, true]))
  );
  const [expandedSub, setExpandedSub] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      Object.entries(grouped).forEach(([cat, subMap]) => {
        Object.keys(subMap).forEach((sub) => {
          initial[`${cat}_${sub}`] = true;
        });
      });
      return initial;
    }
  );

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      Object.keys(grouped).forEach((k) => {
        if (next[k] === undefined) next[k] = true;
      });
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
          const txCount = Object.values(subMap).reduce((s, l) => s + l.length, 0);
          const catTotal = Object.values(subMap).reduce(
            (s, txs) => s + txs.reduce((st, tx) => st + tx.amount, 0), 0
          );
          const isOpen = expanded[cat] ?? true;

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
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: color + '15' }}
                >
                  <Folder size={18} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{cat}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {txCount} {t.tx} · {formatAmount(catTotal)} ₺
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className={cn(
                    'text-gray-400 transition-transform duration-200',
                    isOpen && 'rotate-90'
                  )}
                />
              </button>

              {isOpen &&
                Object.entries(subMap).map(([sub, txs]) => {
                  const subKey = `${cat}_${sub}`;
                  const isSubOpen = expandedSub[subKey] ?? true;
                  const subTotal = txs.reduce((s, tx) => s + tx.amount, 0);

                  return (
                    <div key={sub} className="border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() =>
                          setExpandedSub((p) => ({ ...p, [subKey]: !p[subKey] }))
                        }
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <Tag size={14} className="text-blue-500 ml-4" />
                        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                          {sub}
                        </span>
                        <span className="text-xs text-gray-500 mr-1">
                          {txs.length} · {formatAmount(subTotal)}₺
                        </span>
                        <ChevronRight
                          size={14}
                          className={cn(
                            'text-gray-400 transition-transform duration-200',
                            isSubOpen && 'rotate-90'
                          )}
                        />
                      </button>

                      {isSubOpen &&
                        txs
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((tx) => (
                            <TransactionTile
                              key={tx.transactionId}
                              tx={tx}
                              onDelete={onDelete}
                              onEdit={onEdit}
                            />
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

// ── Transaction Tile ──────────────────────────────────────

function TransactionTile({
  tx,
  onDelete,
  onEdit,
}: {
  tx: Transaction;
  onDelete: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;  // ← new
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/20 hover:bg-gray-100/50 dark:hover:bg-gray-600/20 transition-colors group">
      <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
        <ArrowDownRight size={14} className="text-red-500" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
          {tx.title}
        </p>
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
        {formatAmount(tx.amount)} {tx.currency}
      </p>

      {/* ── Action Buttons (visible on hover on desktop, always on mobile) ── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Edit button */}
        <button
          onClick={() => onEdit(tx)}
          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
          title="Düzenle"
        >
          <Pencil size={13} />
        </button>

        {/* Delete button */}
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

// ── Empty State ───────────────────────────────────────────

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