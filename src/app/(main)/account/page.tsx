// src/app/(main)/account/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTransactionStore } from '@/store/transactionStore';
import { useAuthStore } from '@/store/authStore';
import { FirestoreService } from '@/services/firestoreService';
import { formatAmount } from '@/lib/formatters';
import { Plus, CreditCard, Wallet, ArrowLeft, Trash2, Inbox, Pencil, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { useSettingsStore } from '@/store/settingsStore';
import { calculateCreditCardCycle } from '@/lib/creditCard';

// ── Date helpers ──────────────────────────────────────────

/**
 * Given a cutoff day-of-month and a reference date (defaults to today),
 * returns the next cutoff date that is >= today.
 *
 * e.g. cutoffDay=3, today=May 15 → Jun 3
 *      cutoffDay=3, today=May 2  → May 3
 *      cutoffDay=3, today=May 3  → May 3  (inclusive)
 */
function computeNextCutoff(cutoffDay: number, today = new Date()): Date {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based

  // Try this month's cutoff
  const thisMonthCutoff = new Date(y, m, cutoffDay);
  if (today <= thisMonthCutoff) return thisMonthCutoff;

  // Otherwise next month's cutoff
  return new Date(y, m + 1, cutoffDay);
}

/**
 * Returns the cutoff date of the current billing period
 * (the most recent cutoff that has already passed or is today).
 */
function computeCurrentPeriodStart(cutoffDay: number, today = new Date()): Date {
  const y = today.getFullYear();
  const m = today.getMonth();

  const thisMonthCutoff = new Date(y, m, cutoffDay);
  if (today >= thisMonthCutoff) return thisMonthCutoff;

  // Previous month
  return new Date(y, m - 1, cutoffDay);
}

/**
 * Due date = cutoffDay of the month AFTER the next cutoff
 * e.g. nextCutoff = Jun 3 → dueDate = Jun 3 + 10 days grace = Jun 13
 * (Turkish banks typically give 10 days; adjust GRACE_DAYS as needed)
 */
const GRACE_DAYS = 10;

function computeDueDate(nextCutoff: Date): Date {
  const d = new Date(nextCutoff);
  d.setDate(d.getDate() + GRACE_DAYS);
  return d;
}

function formatDateTR(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { bankDataList, loadAllData, isLoading, deleteAccount } = useTransactionStore();
  const user = useAuthStore(s => s.user);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [showAddBank, setShowAddBank] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const allAccounts = bankDataList.flatMap((bank: any) =>
    (bank.accounts ?? []).map((acc: any) => ({
      ...acc,
      bankId: bank.bankId,
      bankName: bank.bankName,
    }))
  );

  const debitAccounts = allAccounts.filter(a => a.isDebit !== false);
  const creditAccounts = allAccounts.filter(a => a.isDebit === false);
  const totalBalance = debitAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const totalDebt = creditAccounts.reduce((s, a) => s + (a.totalDebt ?? 0), 0);


  const handleUpdate = async (updatedAcc: any) => {
    const user = useAuthStore.getState().user; // need this import
    if (!user) return;

    const updated = bankDataList.map((bank: any) => ({
      ...bank,
      accounts: bank.accounts?.map((a: any) =>
        a.accountId === updatedAcc.accountId ? { ...a, ...updatedAcc } : a
      ),
    }));

    // Use FirestoreService directly for account updates
    await FirestoreService.saveAllData(user.uid, { bankData: updated });
    await loadAllData();
    setEditingAccount(null);
    toast.success('Hesap güncellendi');
  };

  const handleDelete = async (acc: any) => {
    try {
      await deleteAccount(acc.accountId, acc.bankId);
      if (selectedAccountId === acc.accountId) setSelectedAccountId(undefined);
      toast.success('Hesap ve ilgili işlemler silindi');
    } catch {
      toast.error('Hesap silinemedi');
    }
  };

  const handleAddBank = async (bank: any) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = [...bankDataList, bank];
    await FirestoreService.saveAllData(user.uid, { bankData: updated });
    await loadAllData();
    toast.success('Hesap eklendi');
  };

  const handleSelect = (acc: any) => setSelectedAccountId(acc.accountId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-4 pb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link href="/home" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Hesaplarım</h1>
          </div>
          <button
            onClick={() => setShowAddBank(true)}
            className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <Plus size={20} className="text-blue-500" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Toplam Bakiye"
            amount={totalBalance}
            icon={<Wallet size={18} />}
            colorClass="text-green-600 bg-green-50 dark:bg-green-900/20"
          />
          <SummaryCard
            label="Toplam Borç"
            amount={totalDebt}
            icon={<CreditCard size={18} />}
            colorClass="text-red-500 bg-red-50 dark:bg-red-900/20"
          />
        </div>

        {debitAccounts.length > 0 && (
          <AccountSection
            title="Banka Hesapları"
            accounts={debitAccounts}
            selectedId={selectedAccountId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onEdit={setEditingAccount}
            showCreditDetails={false}
          />
        )}
        {creditAccounts.length > 0 && (
          <AccountSection
            title="Kredi Kartları"
            accounts={creditAccounts}
            selectedId={selectedAccountId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onEdit={setEditingAccount}
            showCreditDetails={true}
          />
        )}

        {allAccounts.length === 0 && (
          <div className="flex flex-col items-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <Inbox size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Hesap bulunamadı
            </p>
            <p className="text-xs text-gray-400">+ butonuyla hesap ekleyin</p>
          </div>
        )}

        {showAddBank && (
          <AddBankModal
            onSave={handleAddBank}
            onClose={() => setShowAddBank(false)}
          />
        )}

        {editingAccount && (
          <EditAccountModal
            account={editingAccount}
            onSave={handleUpdate}
            onClose={() => setEditingAccount(null)}
          />
        )}
      </div>
    </AuthGuard>
  );
}

// ── Summary Card ──────────────────────────────────────────

function SummaryCard({
  label,
  amount,
  icon,
  colorClass,
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className={cn('rounded-2xl p-4', colorClass)}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm font-bold">{formatAmount(amount)} ₺</p>
    </div>
  );
}

// ── Account Section ───────────────────────────────────────

function AccountSection({
  title,
  accounts,
  selectedId,
  onSelect,
  onDelete,
  onEdit,
  showCreditDetails,
}: {
  title: string;
  accounts: any[];
  selectedId: number | undefined;
  onSelect: (acc: any) => void;
  onDelete: (acc: any) => void;
  onEdit: (acc: any) => void;
  showCreditDetails: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
        {title}
      </p>
      {accounts.map((acc: any) => (
        <AccountCard
          key={acc.accountId}
          acc={acc}
          isSelected={selectedId === acc.accountId}
          onSelect={onSelect}
          onDelete={onDelete}
          onEdit={onEdit}
          showCreditDetails={showCreditDetails}
        />
      ))}
    </div>
  );
}

// ── Account Card ──────────────────────────────────────────

function AccountCard({
  acc,
  isSelected,
  onSelect,
  onDelete,
  onEdit,
  showCreditDetails,
}: {
  acc: any;
  isSelected: boolean;
  onSelect: (acc: any) => void;
  onDelete: (acc: any) => void;
  onEdit: (acc: any) => void;
  showCreditDetails: boolean;
}) {
  const isCreditCard = acc.isDebit === false;

  // ── Compute live cutoff / due dates ──
  const today = new Date();
  const cutoffDay = acc.cutoffDate || 1;
  const nextCutoff = computeNextCutoff(cutoffDay, today);
  const dueDate = computeDueDate(nextCutoff);

  return (
    <div
      onClick={() => onSelect(acc)}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-md',
        isSelected
          ? 'border-blue-500 dark:border-blue-400'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            isCreditCard
              ? 'bg-purple-100 dark:bg-purple-900/30'
              : 'bg-green-100 dark:bg-green-900/30'
          )}
        >
          {isCreditCard ? (
            <CreditCard size={18} className="text-purple-600" />
          ) : (
            <Wallet size={18} className="text-green-600" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {acc.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {acc.bankName} · {acc.type}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {formatAmount(acc.balance ?? 0)} {acc.currency}
              </p>
              {isSelected && (
                <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-md">
                  Seçili
                </span>
              )}
            </div>
          </div>

          {/* Credit Details */}
          {showCreditDetails && isCreditCard && (
            <div className="mt-3 space-y-2">
              {/* Utilization bar */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-gray-400">Kullanım</span>
                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                    %{acc.creditLimit > 0
                      ? Math.round(((acc.totalDebt ?? 0) / acc.creditLimit) * 100)
                      : 0}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      ((acc.totalDebt ?? 0) / (acc.creditLimit || 1)) >= 0.8
                        ? 'bg-red-500'
                        : ((acc.totalDebt ?? 0) / (acc.creditLimit || 1)) >= 0.5
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                    )}
                    style={{
                      width: `${Math.min(
                        ((acc.totalDebt ?? 0) / (acc.creditLimit || 1)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* 4-item grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Limit', value: formatAmount(acc.creditLimit ?? 0) + ' ₺', color: 'text-blue-500' },
                  { label: 'Kullanılan', value: formatAmount(acc.totalDebt ?? 0) + ' ₺', color: 'text-red-500' },
                  { label: 'Kalan', value: formatAmount(acc.availableCredit ?? 0) + ' ₺', color: 'text-green-500' },
                  { label: 'Min Ödeme', value: formatAmount(acc.minPayment ?? 0) + ' ₺', color: 'text-orange-500' },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                    <p className="text-[10px] text-gray-400">{item.label}</p>
                    <p className={cn('text-xs font-semibold', item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Period info — using shared cycle calculator */}
              {(() => {
                const cycle = calculateCreditCardCycle(cutoffDay);
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400">
                        {acc.previousDebt > 0 ? 'Ekstre Son Ödeme' : 'Sonraki Son Ödeme'}
                      </p>
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {formatDateTR(cycle.statementDueDate)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Kesim: Her ayın {cutoffDay}'i
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400">Sonraki Kesim</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        {formatDateTR(cycle.nextCutoffDate)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Son Ödeme: {formatDateTR(cycle.nextDueDate)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Debt breakdown */}
              {(acc.previousDebt > 0 || acc.remainingDebt > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {acc.previousDebt > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400">Önceki Dönem</p>
                      <p className="text-xs font-semibold text-orange-600">
                        {formatAmount(acc.previousDebt)} ₺
                      </p>
                    </div>
                  )}
                  {acc.remainingDebt > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400">Dönem Borcu</p>
                      <p className="text-xs font-semibold text-red-600">
                        {formatAmount(acc.remainingDebt)} ₺
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Transaction count */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>{(acc.transactions || []).length} işlem</span>
                <span>·</span>
                <span>
                  {(acc.transactions || []).filter((t: any) => !t.isSurplus).length} gider
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit & Delete */}
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(acc); }}
          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500 transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(acc); }}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Edit Account Modal ────────────────────────────────────

function EditAccountModal({
  account,
  onSave,
  onClose,
}: {
  account: any;
  onSave: (acc: any) => void;
  onClose: () => void;
}) {
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  const [name, setName] = useState(account.name || '');
  const [bankName, setBankName] = useState(account.bankName || '');
  const [balance, setBalance] = useState(String(account.balance ?? ''));
  const [creditLimit, setCreditLimit] = useState(String(account.creditLimit ?? ''));
  const [cutoffDay, setCutoffDay] = useState(String(account.cutoffDate ?? '1'));
  const [currency, setCurrency] = useState(account.currency || 'TRY');

  const isCreditCard = account.isDebit === false;

  const t = {
    title:      lang === 'tr' ? 'Hesap Düzenle' : 'Edit Account',
    bankName:   lang === 'tr' ? 'Banka Adı' : 'Bank Name',
    accName:    lang === 'tr' ? 'Hesap Adı' : 'Account Name',
    balance:    lang === 'tr' ? 'Bakiye' : 'Balance',
    currency:   lang === 'tr' ? 'Para Birimi' : 'Currency',
    limit:      lang === 'tr' ? 'Kredi Limiti' : 'Credit Limit',
    cutoff:     lang === 'tr' ? 'Kesim Günü (Bu Ay)' : 'Cutoff Day (This Month)',
    cutoffSub:  lang === 'tr' ? 'Her ayın kaçıncı günü? (Banka değiştirebilir)' : 'Which day of the month? (Bank may change)',
    cancel:     lang === 'tr' ? 'İptal' : 'Cancel',
    save:       lang === 'tr' ? 'Güncelle' : 'Update',
    accType:    lang === 'tr' ? 'Hesap Türü' : 'Account Type',
    creditCard: lang === 'tr' ? 'Kredi Kartı' : 'Credit Card',
    bankAcc:    lang === 'tr' ? 'Banka Hesabı' : 'Bank Account',
    currentDebt:lang === 'tr' ? 'Mevcut Borç' : 'Current Debt',
    available:  lang === 'tr' ? 'Kullanılabilir' : 'Available',
    txCount:    lang === 'tr' ? 'İşlem Sayısı' : 'Transactions',
    validation: lang === 'tr' ? 'Banka ve hesap adı girin' : 'Enter bank and account name',
    nextCutoff: lang === 'tr' ? 'Sonraki Kesim' : 'Next Cutoff',
    dueDate:    lang === 'tr' ? 'Son Ödeme' : 'Due Date',
    graceDays:  lang === 'tr' ? `(+${GRACE_DAYS} gün vade)` : `(+${GRACE_DAYS} day grace)`,
  };

  const txCount = (account.transactions || []).length;
  const expenseCount = (account.transactions || []).filter((tx: any) => !tx.isSurplus).length;
  const currentDebt = account.totalDebt ?? 0;
  const newLimit = parseFloat(creditLimit) || 0;
  const newAvailable = Math.max(newLimit - currentDebt, 0);
  const usagePercent = newLimit > 0 ? (currentDebt / newLimit) * 100 : 0;

  // Live date preview based on typed cutoffDay
  const parsedCutoffDay = Math.min(Math.max(parseInt(cutoffDay) || 1, 1), 31);
  const previewNextCutoff = computeNextCutoff(parsedCutoffDay);
  const previewDueDate = computeDueDate(previewNextCutoff);

  const handleSave = () => {
    if (!name.trim() || !bankName.trim()) {
      toast.error(t.validation);
      return;
    }
    const newLimitVal = isCreditCard ? (parseFloat(creditLimit) || 0) : undefined;

    onSave({
      accountId: account.accountId,
      name: name.trim(),
      bankName: bankName.trim(),
      balance: parseFloat(balance) || 0,
      currency,
      creditLimit: newLimitVal,
      cutoffDate: isCreditCard ? parsedCutoffDay : account.cutoffDate,
      availableCredit:
        newLimitVal !== undefined ? Math.max(newLimitVal - currentDebt, 0) : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              isCreditCard ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-green-100 dark:bg-green-900/30'
            )}>
              {isCreditCard
                ? <CreditCard size={18} className="text-purple-600" />
                : <Wallet size={18} className="text-green-600" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.title}</h3>
              <p className="text-xs text-gray-400">
                {t.accType}: {isCreditCard ? t.creditCard : t.bankAcc}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="text-gray-400 text-lg">✕</span>
          </button>
        </div>

        {/* Current Status */}
        {isCreditCard && (
          <div className="px-6 pt-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {lang === 'tr' ? 'Mevcut Durum' : 'Current Status'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">{t.currentDebt}</p>
                  <p className="text-sm font-bold text-red-500">{formatAmount(currentDebt)}₺</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">{t.available}</p>
                  <p className="text-sm font-bold text-green-500">
                    {formatAmount(account.availableCredit ?? 0)}₺
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">{t.txCount}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {expenseCount}/{txCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                {t.bankName}
              </label>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={lang === 'tr' ? 'Örn: Ziraat Bankası' : 'e.g. Chase Bank'}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                {t.accName}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'tr' ? 'Örn: Vadesiz Hesap' : 'e.g. Checking'}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          {!isCreditCard && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                  {t.balance}
                </label>
                <input
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                  {t.currency}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="TRY">🇹🇷 TRY</option>
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                </select>
              </div>
            </div>
          )}

          {isCreditCard && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Credit Limit */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                    {t.limit}
                  </label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                  />
                </div>

                {/* Cutoff Day — editable every time */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
                    {t.cutoff}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={cutoffDay}
                    onChange={(e) => setCutoffDay(e.target.value)}
                    placeholder="1"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{t.cutoffSub}</p>
                </div>
              </div>

              {/* Live date preview — updates as user types */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-blue-500" />
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                    {lang === 'tr' ? 'Tarih Önizlemesi' : 'Date Preview'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-1">{t.nextCutoff}</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {formatDateTR(previewNextCutoff)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {lang === 'tr' ? `Her ayın ${parsedCutoffDay}'i` : `Day ${parsedCutoffDay} of each month`}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-1">{t.dueDate}</p>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {formatDateTR(previewDueDate)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{t.graceDays}</p>
                  </div>
                </div>
              </div>

              {/* Limit preview */}
              {creditLimit && (
                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-400">
                    {lang === 'tr' ? 'Limit Önizlemesi' : 'Limit Preview'}
                  </p>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-purple-600 dark:text-purple-400">
                        {t.currentDebt}: {formatAmount(currentDebt)}₺
                      </span>
                      <span className="font-bold text-purple-700 dark:text-purple-300">
                        %{usagePercent.toFixed(0)}
                      </span>
                    </div>
                    <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all',
                          usagePercent >= 80 ? 'bg-red-500' :
                          usagePercent >= 50 ? 'bg-orange-500' : 'bg-green-500'
                        )}
                        style={{ width: `${Math.min(usagePercent, 100).toFixed(0)}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-[10px] text-purple-500">{t.limit}</p>
                      <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                        {formatAmount(newLimit)}₺
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-purple-500">{t.currentDebt}</p>
                      <p className="text-xs font-bold text-red-500">
                        {formatAmount(currentDebt)}₺
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-purple-500">{t.available}</p>
                      <p className="text-xs font-bold text-green-500">
                        {formatAmount(newAvailable)}₺
                      </p>
                    </div>
                  </div>
                  {newLimit < currentDebt && newLimit > 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                      <span>⚠️</span>
                      <span>
                        {lang === 'tr' ? 'Limit mevcut borçtan düşük!' : 'Limit is lower than current debt!'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Bank Modal ────────────────────────────────────────

function AddBankModal({
  onSave,
  onClose,
}: {
  onSave: (bank: any) => void;
  onClose: () => void;
}) {
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'debit' | 'credit'>('debit');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [cutoffDay, setCutoffDay] = useState('1');

  // Live preview for new card too
  const parsedCutoffDay = Math.min(Math.max(parseInt(cutoffDay) || 1, 1), 31);
  const previewNextCutoff = computeNextCutoff(parsedCutoffDay);
  const previewDueDate = computeDueDate(previewNextCutoff);

  const handleSave = () => {
    if (!bankName.trim() || !accountName.trim()) {
      toast.error('Banka ve hesap adı girin');
      return;
    }

    const bankId = Date.now();
    const accountId = Date.now() + 1;
    const isDebit = accountType === 'debit';

    const account: any = {
      accountId,
      name: accountName.trim(),
      type: isDebit ? 'checking' : 'credit_card',
      balance: parseFloat(balance) || 0,
      transactions: [],
      debts: [],
      currency: 'TRY',
      isDebit,
      cutoffDate: parsedCutoffDay,
    };

    if (!isDebit) {
      const limit = parseFloat(creditLimit) || 0;
      account.creditLimit = limit;
      account.availableCredit = limit;
      account.totalDebt = 0;
      account.currentDebt = 0;
      account.remainingDebt = 0;
      account.previousDebt = 0;
      account.minPayment = 0;
      account.remainingMinPayment = 0;
    }

    onSave({ bankId, bankName: bankName.trim(), accounts: [account] });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-t-3xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hesap Ekle</h3>

        <div className="space-y-3">
          <Field label="Banka Adı *" value={bankName} onChange={setBankName} placeholder="Örn: Ziraat Bankası" />
          <Field label="Hesap Adı *" value={accountName} onChange={setAccountName} placeholder="Örn: Vadesiz Hesap" />

          {/* Account Type */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Hesap Türü</p>
            <div className="flex gap-2">
              {(['debit', 'credit'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setAccountType(type)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all',
                    accountType === type
                      ? type === 'debit'
                        ? 'bg-green-500 text-white border-transparent'
                        : 'bg-purple-500 text-white border-transparent'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {type === 'debit' ? <><Wallet size={14} /> Banka</> : <><CreditCard size={14} /> Kredi</>}
                </button>
              ))}
            </div>
          </div>

          <Field label="Bakiye" value={balance} onChange={setBalance} placeholder="0.00" type="number" />

          {accountType === 'credit' && (
            <>
              <Field label="Kredi Limiti" value={creditLimit} onChange={setCreditLimit} placeholder="0.00" type="number" />

              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  Kesim Günü (1-31)
                </p>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cutoffDay}
                  onChange={(e) => setCutoffDay(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Live date preview */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={13} className="text-blue-500" />
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Tarih Önizlemesi</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400">Sonraki Kesim</p>
                    <p className="text-xs font-bold text-blue-600">{formatDateTR(previewNextCutoff)}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                    <p className="text-[10px] text-gray-400">Son Ödeme</p>
                    <p className="text-xs font-bold text-orange-600">{formatDateTR(previewDueDate)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}