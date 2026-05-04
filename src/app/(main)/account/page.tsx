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
import { useAccountStore } from '@/store/accountStore';

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
  const { selectedAccount: storedAccount, setSelectedAccount } = useAccountStore();
const selectedAccountId = storedAccount?.accountId;
  const user = useAuthStore(s => s.user);
  const [showAddBank, setShowAddBank] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  useEffect(() => {
    loadAllData();
  }, []);

    // Auto-select first account if none selected
  useEffect(() => {
    if (bankDataList.length > 0 && !selectedAccount) {
      const b = bankDataList[0];
      if (b?.accounts?.[0]) {
        setSelectedAccount({ ...b.accounts[0], bankId: b.bankId, bankName: b.bankName });
      }
    }
  }, [bankDataList]);

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
    if (storedAccount?.accountId === acc.accountId) setSelectedAccount(null);
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

const handleSelect = (acc: any) => {
  if (storedAccount?.accountId === acc.accountId) {
    setSelectedAccount(null); // deselect
  } else {
    setSelectedAccount({ ...acc });
  }
};

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
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  const [step, setStep] = useState<1 | 2>(1);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'debit' | 'credit'>('debit');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [creditLimit, setCreditLimit] = useState('');
  const [cutoffDay, setCutoffDay] = useState('1');

  const parsedCutoffDay = Math.min(Math.max(parseInt(cutoffDay) || 1, 1), 31);
  const previewNextCutoff = computeNextCutoff(parsedCutoffDay);
  const previewDueDate = computeDueDate(previewNextCutoff);

  const isCredit = accountType === 'credit';

  const t = {
    title:       lang === 'tr' ? 'Yeni Hesap Ekle' : 'Add New Account',
    step1:       lang === 'tr' ? 'Hesap Bilgileri' : 'Account Info',
    step2:       lang === 'tr' ? 'Detaylar' : 'Details',
    bankName:    lang === 'tr' ? 'Banka Adı' : 'Bank Name',
    bankPh:      lang === 'tr' ? 'Örn: Ziraat Bankası' : 'e.g. Chase Bank',
    accName:     lang === 'tr' ? 'Hesap Adı' : 'Account Name',
    accPh:       lang === 'tr' ? 'Örn: Vadesiz Hesap' : 'e.g. Checking',
    accType:     lang === 'tr' ? 'Hesap Türü' : 'Account Type',
    debitLabel:  lang === 'tr' ? 'Banka Hesabı' : 'Bank Account',
    creditLabel: lang === 'tr' ? 'Kredi Kartı' : 'Credit Card',
    debitDesc:   lang === 'tr' ? 'Vadesiz, tasarruf, yatırım hesabı' : 'Checking, savings, investment',
    creditDesc:  lang === 'tr' ? 'Kredi kartı ve taksitli ödemeler' : 'Credit card and installment payments',
    balance:     lang === 'tr' ? 'Mevcut Bakiye' : 'Current Balance',
    currency:    lang === 'tr' ? 'Para Birimi' : 'Currency',
    limit:       lang === 'tr' ? 'Kredi Limiti' : 'Credit Limit',
    cutoff:      lang === 'tr' ? 'Hesap Kesim Günü' : 'Statement Cutoff Day',
    cutoffSub:   lang === 'tr' ? 'Her ayın kaçıncı günü hesabınız kesilir?' : 'Which day does your statement close?',
    preview:     lang === 'tr' ? 'Tarih Önizlemesi' : 'Date Preview',
    nextCutoff:  lang === 'tr' ? 'Sonraki Kesim' : 'Next Statement',
    dueDate:     lang === 'tr' ? 'Son Ödeme' : 'Due Date',
    grace:       lang === 'tr' ? '+10 gün vade' : '+10 day grace',
    next:        lang === 'tr' ? 'Devam Et' : 'Continue',
    back:        lang === 'tr' ? 'Geri' : 'Back',
    save:        lang === 'tr' ? 'Hesabı Ekle' : 'Add Account',
    cancel:      lang === 'tr' ? 'İptal' : 'Cancel',
    validation1: lang === 'tr' ? 'Banka ve hesap adı girin' : 'Enter bank and account name',
  };

  const handleNext = () => {
    if (!bankName.trim() || !accountName.trim()) {
      toast.error(t.validation1);
      return;
    }
    setStep(2);
  };

  const handleSave = () => {
    if (!bankName.trim() || !accountName.trim()) {
      toast.error(t.validation1);
      return;
    }

    const bankId = Date.now();
    const accountId = Date.now() + 1;

    const account: any = {
      accountId,
      name: accountName.trim(),
      type: isCredit ? 'credit_card' : 'checking',
      balance: parseFloat(balance) || 0,
      transactions: [],
      debts: [],
      currency,
      isDebit: !isCredit,
      cutoffDate: parsedCutoffDay,
    };

    if (isCredit) {
      const limit = parseFloat(creditLimit) || 0;
      account.creditLimit = limit;
      account.availableCredit = limit;
      account.totalDebt = 0;
      account.currentDebt = 0;
      account.remainingDebt = 0;
      account.previousDebt = 0;
      account.minPayment = 0;
      account.remainingMinPayment = 0;
      account.debtPayments = [];
    }

    onSave({ bankId, bankName: bankName.trim(), accounts: [account] });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center',
              isCredit
                ? 'bg-purple-100 dark:bg-purple-900/30'
                : 'bg-green-100 dark:bg-green-900/30'
            )}>
              {isCredit
                ? <CreditCard size={22} className="text-purple-600" />
                : <Wallet size={22} className="text-green-600" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.title}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {step === 1 ? t.step1 : t.step2}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                step === 1
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
              )}>1</div>
              <div className={cn(
                'w-10 h-0.5 rounded transition-colors',
                step === 2 ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
              )} />
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                step === 2
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              )}>2</div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Step 1: Account Type + Names ── */}
        {step === 1 && (
          <div className="px-8 py-6 space-y-6">
            {/* Account type selector */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t.accType}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(['debit', 'credit'] as const).map((type) => {
                  const isSelected = accountType === type;
                  const color = type === 'debit' ? 'green' : 'purple';
                  return (
                    <button
                      key={type}
                      onClick={() => setAccountType(type)}
                      className={cn(
                        'relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all',
                        isSelected
                          ? type === 'debit'
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                            : 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {/* Selection dot */}
                      <div className={cn(
                        'absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? type === 'debit'
                            ? 'border-green-500 bg-green-500'
                            : 'border-purple-500 bg-purple-500'
                          : 'border-gray-300 dark:border-gray-600'
                      )}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>

                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        type === 'debit'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-purple-100 dark:bg-purple-900/30'
                      )}>
                        {type === 'debit'
                          ? <Wallet size={20} className="text-green-600" />
                          : <CreditCard size={20} className="text-purple-600" />}
                      </div>

                      <div>
                        <p className={cn(
                          'text-sm font-bold',
                          isSelected
                            ? type === 'debit' ? 'text-green-700 dark:text-green-400' : 'text-purple-700 dark:text-purple-400'
                            : 'text-gray-900 dark:text-white'
                        )}>
                          {type === 'debit' ? t.debitLabel : t.creditLabel}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {type === 'debit' ? t.debitDesc : t.creditDesc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bank + Account name — side by side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  {t.bankName} <span className="text-red-400">*</span>
                </label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder={t.bankPh}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  {t.accName} <span className="text-red-400">*</span>
                </label>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={t.accPh}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Financial Details ── */}
        {step === 2 && (
          <div className="px-8 py-6 space-y-6">
            {/* Account summary banner */}
            <div className={cn(
              'flex items-center gap-3 p-4 rounded-2xl',
              isCredit
                ? 'bg-purple-50 dark:bg-purple-900/10'
                : 'bg-green-50 dark:bg-green-900/10'
            )}>
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                isCredit
                  ? 'bg-purple-100 dark:bg-purple-900/30'
                  : 'bg-green-100 dark:bg-green-900/30'
              )}>
                {isCredit
                  ? <CreditCard size={18} className="text-purple-600" />
                  : <Wallet size={18} className="text-green-600" />}
              </div>
              <div>
                <p className={cn('text-sm font-bold', isCredit ? 'text-purple-700 dark:text-purple-300' : 'text-green-700 dark:text-green-300')}>
                  {bankName} — {accountName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isCredit ? t.creditLabel : t.debitLabel}
                </p>
              </div>
            </div>

            {/* Balance + Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  {t.balance}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                    {currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                  {t.currency}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: 'TRY', flag: '🇹🇷', symbol: '₺' },
                    { code: 'USD', flag: '🇺🇸', symbol: '$' },
                    { code: 'EUR', flag: '🇪🇺', symbol: '€' },
                  ].map(({ code, flag, symbol }) => (
                    <button
                      key={code}
                      onClick={() => setCurrency(code)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
                        currency === code
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      )}
                    >
                      <span className="text-base">{flag}</span>
                      <span>{symbol} {code}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Credit card specific fields */}
            {isCredit && (
              <>
                <div className="w-full h-px bg-gray-100 dark:bg-gray-800" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Credit Limit */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                      {t.limit}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors pr-8"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">₺</span>
                    </div>
                  </div>

                  {/* Cutoff Day */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                      {t.cutoff}
                    </label>
                    <p className="text-xs text-gray-400 mb-2">{t.cutoffSub}</p>
                    {/* Day picker grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {[1,5,10,14,15,20,25,28,29,30,31].map((day) => (
                        <button
                          key={day}
                          onClick={() => setCutoffDay(String(day))}
                          className={cn(
                            'py-2 rounded-lg text-xs font-semibold transition-colors',
                            parsedCutoffDay === day
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          )}
                        >
                          {day}
                        </button>
                      ))}
                      {/* Custom input */}
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={cutoffDay}
                          onChange={(e) => setCutoffDay(e.target.value)}
                          placeholder="?"
                          className="w-full py-2 px-2 rounded-lg text-xs font-semibold text-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date preview */}
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar size={16} className="text-blue-500" />
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{t.preview}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">{t.nextCutoff}</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatDateTR(previewNextCutoff)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {lang === 'tr' ? `Her ayın ${parsedCutoffDay}'i` : `Day ${parsedCutoffDay} each month`}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">{t.dueDate}</p>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {formatDateTR(previewDueDate)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">{t.grace}</p>
                    </div>
                  </div>
                </div>

                {/* Limit summary */}
                {creditLimit && parseFloat(creditLimit) > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: t.limit, value: `${formatAmount(parseFloat(creditLimit) || 0)}₺`, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                      { label: lang === 'tr' ? 'Başlangıç Borcu' : 'Starting Debt', value: '0₺', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
                      { label: lang === 'tr' ? 'Kullanılabilir' : 'Available', value: `${formatAmount(parseFloat(creditLimit) || 0)}₺`, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                    ].map((item) => (
                      <div key={item.label} className={cn('rounded-xl p-3 text-center', item.bg)}>
                        <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
                        <p className={cn('text-sm font-bold', item.color)}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Footer Actions ── */}
        <div className="flex items-center justify-between px-8 py-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {step === 1 ? t.cancel : `← ${t.back}`}
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className={cn('w-2 h-2 rounded-full', step >= 1 ? 'bg-blue-500' : 'bg-gray-300')} />
            <span className={cn('w-2 h-2 rounded-full', step >= 2 ? 'bg-blue-500' : 'bg-gray-300')} />
          </div>

          {step === 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {t.next} →
            </button>
          ) : (
            <button
              onClick={handleSave}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors text-white',
                isCredit
                  ? 'bg-purple-500 hover:bg-purple-600'
                  : 'bg-green-500 hover:bg-green-600'
              )}
            >
              {isCredit ? <CreditCard size={15} /> : <Wallet size={15} />}
              {t.save}
            </button>
          )}
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