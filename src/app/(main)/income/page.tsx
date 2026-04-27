// src/app/(main)/income/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useIncomeStore } from '@/store/incomeStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Income, createIncome } from '@/models/income';
import { formatAmount, formatDateShort } from '@/lib/formatters';
import {
  Briefcase, GraduationCap, User, TrendingUp,
  PlusCircle, ChevronRight, X, Check, Trash2,
  Building2, PieChart, History, Inbox, ArrowLeft,
  Pencil, RefreshCw, Calendar, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';

// ── Types & Constants ─────────────────────────────────────

type IncomeSource = 'İş' | 'Burs' | 'Emekli';
const SOURCES: IncomeSource[] = ['İş', 'Burs', 'Emekli'];

const sourceConfig: Record<IncomeSource, {
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  labelTr: string;
  labelEn: string;
}> = {
  'İş':     { color: 'text-blue-500',   bgColor: 'bg-blue-500',   icon: <Briefcase size={14} />,    labelTr: 'İş',     labelEn: 'Work' },
  'Burs':   { color: 'text-purple-500', bgColor: 'bg-purple-500', icon: <GraduationCap size={14} />, labelTr: 'Burs',   labelEn: 'Scholarship' },
  'Emekli': { color: 'text-orange-500', bgColor: 'bg-orange-500', icon: <User size={14} />,          labelTr: 'Emekli', labelEn: 'Pension' },
};

// ── Main Component ────────────────────────────────────────

export default function IncomePage() {
  const { incomes, loadIncomes, addIncome, updateIncome, deleteIncome, getTotalIncome } = useIncomeStore();
  const { bankDataList, loadAllData } = useTransactionStore();
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const t = {
    title:        lang === 'tr' ? 'Gelirler' : 'Income',
    selectAcc:    lang === 'tr' ? 'Hesap Seçin' : 'Select Account',
    addIncome:    lang === 'tr' ? 'Gelir Ekle' : 'Add Income',
    editIncome:   lang === 'tr' ? 'Gelir Düzenle' : 'Edit Income',
    source:       lang === 'tr' ? 'Gelir Kaynağı' : 'Income Source',
    recurring:    lang === 'tr' ? 'Düzenli Gelir' : 'Recurring Income',
    recurringDay: lang === 'tr' ? 'Her ayın kaçıncı günü?' : 'Which day of the month?',
    dayOf:        lang === 'tr' ? 'Ayın' : 'Day',
    amount:       lang === 'tr' ? 'Miktar' : 'Amount',
    amountPh:     lang === 'tr' ? 'Miktar girin' : 'Enter amount',
    summary:      lang === 'tr' ? 'Gelir Özeti' : 'Income Summary',
    totalIncome:  lang === 'tr' ? 'Toplam Gelir' : 'Total Income',
    workIncome:   lang === 'tr' ? 'İş Geliri' : 'Work Income',
    scholIncome:  lang === 'tr' ? 'Burs Geliri' : 'Scholarship Income',
    pensIncome:   lang === 'tr' ? 'Emekli Geliri' : 'Pension Income',
    recent:       lang === 'tr' ? 'Son Gelirler' : 'Recent Income',
    noIncome:     lang === 'tr' ? 'Henüz gelir eklenmemiş' : 'No income added yet',
    cancel:       lang === 'tr' ? 'İptal' : 'Cancel',
    save:         lang === 'tr' ? 'Kaydet' : 'Save',
    update:       lang === 'tr' ? 'Güncelle' : 'Update',
    added:        lang === 'tr' ? 'Gelir başarıyla eklendi' : 'Income added successfully',
    updated:      lang === 'tr' ? 'Gelir güncellendi' : 'Income updated',
    deleted:      lang === 'tr' ? 'Gelir silindi' : 'Income deleted',
    deleteConf:   lang === 'tr' ? 'Bu geliri silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this income?',
    validation:   lang === 'tr' ? 'Lütfen geçerli bir miktar girin' : 'Please enter a valid amount',
    recurringTag: lang === 'tr' ? 'Düzenli' : 'Recurring',
    everyMonth:   lang === 'tr' ? 'Her ay' : 'Monthly',
    description:  lang === 'tr' ? 'Açıklama' : 'Description',
    descPh:       lang === 'tr' ? 'Opsiyonel' : 'Optional',
  };

  useEffect(() => {
    loadAllData().then(() => loadIncomes()).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (bankDataList.length > 0 && !selectedAccount) {
      const b = bankDataList[0];
      if (b?.accounts?.[0]) setSelectedAccount({ ...b.accounts[0], bankId: b.bankId, bankName: b.bankName });
    }
  }, [bankDataList]);

  const summary = {
    work: incomes.filter(i => i.source === 'İş').reduce((s, i) => s + i.amount, 0),
    scholarship: incomes.filter(i => i.source === 'Burs').reduce((s, i) => s + i.amount, 0),
    pension: incomes.filter(i => i.source === 'Emekli').reduce((s, i) => s + i.amount, 0),
    total: getTotalIncome(),
  };

  const handleAddIncome = async (extra: { isRecurring: boolean; day?: number; description?: string }) => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || parsed <= 0 || !selectedAccount) {
      toast.error(t.validation);
      return;
    }

    const source = SOURCES[selectedSourceIndex];
    const newIncome = createIncome({
      source,
      amount: parsed,
      accountId: selectedAccount.accountId,
      accountName: selectedAccount.name,
      currency: selectedAccount.currency || 'TRY',
      description: extra.description || `${source} ${lang === 'tr' ? 'geliri' : 'income'}`,
      isRecurring: extra.isRecurring,
      day: extra.day,
    });

    await addIncome(newIncome);
    setIsAddingIncome(false);
    setAmount('');
    toast.success(t.added);
  };

  const handleUpdateIncome = async (updatedIncome: Income) => {
    await updateIncome(updatedIncome);
    setEditingIncome(null);
    toast.success(t.updated);
  };

  const handleDeleteIncome = async (income: Income) => {
    if (confirm(t.deleteConf)) {
      await deleteIncome(income.incomeId);
      toast.success(t.deleted);
    }
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [bankIdStr, accountIdStr] = e.target.value.split('_');
    for (const bank of bankDataList) {
      const found = bank.accounts?.find((a: any) => a.accountId === Number(accountIdStr));
      if (found) {
        setSelectedAccount({ ...found, bankId: bank.bankId, bankName: bank.bankName });
        break;
      }
    }
  };

  // Separate recurring and one-time incomes
  const recurringIncomes = incomes.filter(i => (i as any).isRecurring);
  const oneTimeIncomes = incomes.filter(i => !(i as any).isRecurring);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
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
            onClick={() => setIsAddingIncome(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t.addIncome}</span>
          </button>
        </div>

        {/* ── Top Row: Account + Summary ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Account Selector */}
          {bankDataList.length > 0 && (
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-green-600" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{t.selectAcc}</span>
              </div>
              <select
                value={selectedAccount ? `${selectedAccount.bankId}_${selectedAccount.accountId}` : ''}
                onChange={handleAccountChange}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">{t.selectAcc}...</option>
                {bankDataList.map((bank: any) =>
                  bank.accounts?.map((acc: any) => (
                    <option key={acc.accountId} value={`${bank.bankId}_${acc.accountId}`}>
                      {bank.bankName} — {acc.name}
                    </option>
                  ))
                )}
              </select>

              {/* Add Income Button (mobile - below selector) */}
              {!isAddingIncome && (
                <button
                  onClick={() => setIsAddingIncome(true)}
                  className="lg:hidden w-full mt-3 flex items-center justify-center gap-2 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl font-semibold text-sm hover:bg-green-100 transition-colors"
                >
                  <PlusCircle size={16} />
                  {t.addIncome}
                </button>
              )}
            </div>
          )}

          {/* Summary Card */}
          <div className="lg:col-span-3">
            <IncomeSummaryCard summary={summary} t={t} lang={lang} />
          </div>
        </div>

        {/* ── Add Income Form ── */}
        {isAddingIncome && (
          <IncomeFormModal
            mode="add"
            sources={SOURCES}
            selectedSourceIndex={selectedSourceIndex}
            onSourceChange={setSelectedSourceIndex}
            amount={amount}
            onAmountChange={setAmount}
            selectedAccount={selectedAccount}
            onSubmit={handleAddIncome}
            onClose={() => { setIsAddingIncome(false); setAmount(''); }}
            t={t}
            lang={lang}
          />
        )}

        {/* ── Edit Income Modal ── */}
        {editingIncome && (
          <EditIncomeModal
            income={editingIncome}
            bankDataList={bankDataList}
            onSave={handleUpdateIncome}
            onClose={() => setEditingIncome(null)}
            t={t}
            lang={lang}
          />
        )}

        {/* ── Recurring Incomes Section ── */}
        {recurringIncomes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw size={16} className="text-green-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {lang === 'tr' ? 'Düzenli Gelirler' : 'Recurring Income'}
              </span>
              <span className="text-xs text-gray-400 ml-auto">{recurringIncomes.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recurringIncomes.map((income) => {
                const config = sourceConfig[income.source as IncomeSource] ??
                  { color: 'text-gray-500', bgColor: 'bg-gray-500', icon: <User size={14} />, labelTr: income.source, labelEn: income.source };

                return (
                  <div
                    key={income.incomeId}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-lg text-white', config.bgColor)}>
                          {config.icon}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {income.source}
                          </p>
                          <p className="text-[10px] text-gray-400">{income.accountName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingIncome(income)}
                          className="p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteIncome(income)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mb-1">
                      {formatAmount(income.amount)} {income.currency}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <RefreshCw size={9} />
                        {t.recurringTag}
                      </span>
                      {(income as any).day && (
                        <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                          <Calendar size={9} />
                          {t.everyMonth} {(income as any).day}.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recent Incomes (one-time + all) ── */}
        <RecentIncomes
          incomes={incomes}
          onDelete={handleDeleteIncome}
          onEdit={setEditingIncome}
          t={t}
          lang={lang}
        />
      </div>
    </AuthGuard>
  );
}

// ══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════

// ── Income Form Modal (Add) ───────────────────────────────

function IncomeFormModal({
  mode, sources, selectedSourceIndex, onSourceChange,
  amount, onAmountChange, selectedAccount, onSubmit, onClose, t, lang,
}: any) {
  const [isRecurring, setIsRecurring] = useState(false);
  const [day, setDay] = useState('1');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    onSubmit({ isRecurring, day: isRecurring ? parseInt(day) || 1 : undefined, description });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.addIncome}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Account Info */}
          {selectedAccount && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <Building2 size={14} className="text-blue-500" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 truncate">
                {selectedAccount.bankName} — {selectedAccount.name}
              </span>
            </div>
          )}

          {/* Source Selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t.source}</p>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              {sources.map((source: string, i: number) => {
                const config = sourceConfig[source as IncomeSource];
                const isSelected = selectedSourceIndex === i;
                return (
                  <button
                    key={source}
                    onClick={() => onSourceChange(i)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all',
                      isSelected ? `${config.bgColor} text-white shadow` : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {config.icon} {source}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.amount} *</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder={t.amountPh}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.description}</p>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.descPh}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Recurring Toggle */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-green-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.recurring}</span>
              </div>
              <button
                onClick={() => setIsRecurring(!isRecurring)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors',
                  isRecurring ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                )}
              >
                <div className={cn(
                  'w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5',
                  isRecurring ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>

            {isRecurring && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.recurringDay}</p>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{t.dayOf} {d}.</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {t.cancel}
          </button>
          <button onClick={handleSubmit} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors">
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Income Modal ─────────────────────────────────────

function EditIncomeModal({
  income, bankDataList, onSave, onClose, t, lang,
}: {
  income: Income;
  bankDataList: any[];
  onSave: (income: Income) => void;
  onClose: () => void;
  t: any;
  lang: string;
}) {
  const sourceIndex = SOURCES.indexOf(income.source as IncomeSource);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(sourceIndex >= 0 ? sourceIndex : 0);
  const [amount, setAmount] = useState(String(income.amount));
  const [description, setDescription] = useState(income.description || '');
  const [isRecurring, setIsRecurring] = useState(!!(income as any).isRecurring);
  const [day, setDay] = useState(String((income as any).day || 1));
  const [date, setDate] = useState(new Date(income.date).toISOString().split('T')[0]);

  // Find current account
  const [accountId, setAccountId] = useState(income.accountId);
  const [accountName, setAccountName] = useState(income.accountName);

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [bankIdStr, accIdStr] = e.target.value.split('_');
    for (const bank of bankDataList) {
      const found = bank.accounts?.find((a: any) => a.accountId === Number(accIdStr));
      if (found) {
        setAccountId(found.accountId);
        setAccountName(`${bank.bankName} — ${found.name}`);
        break;
      }
    }
  };

  const handleSave = () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      toast.error(t.validation);
      return;
    }

    const updated: Income = {
      ...income,
      source: SOURCES[selectedSourceIndex],
      amount: parsed,
      accountId,
      accountName,
      description,
      date: new Date(date).toISOString(),
      isRecurring,
      day: isRecurring ? parseInt(day) || 1 : undefined,
    } as any;

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Pencil size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.editIncome}</h3>
              <p className="text-xs text-gray-400">ID: #{income.incomeId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Account Selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.selectAcc}</p>
            <select
              value={`_${accountId}`}
              onChange={handleAccountChange}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {bankDataList.map((bank: any) =>
                bank.accounts?.map((acc: any) => (
                  <option key={acc.accountId} value={`${bank.bankId}_${acc.accountId}`}>
                    {bank.bankName} — {acc.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Source Selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t.source}</p>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              {SOURCES.map((source, i) => {
                const config = sourceConfig[source];
                const isSelected = selectedSourceIndex === i;
                return (
                  <button
                    key={source}
                    onClick={() => setSelectedSourceIndex(i)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all',
                      isSelected ? `${config.bgColor} text-white shadow` : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {config.icon} {source}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.amount} *</p>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                {lang === 'tr' ? 'Tarih' : 'Date'}
              </p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.description}</p>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descPh}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Recurring Toggle */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-green-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.recurring}</span>
              </div>
              <button
                onClick={() => setIsRecurring(!isRecurring)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors',
                  isRecurring ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                )}
              >
                <div className={cn(
                  'w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5',
                  isRecurring ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>

            {isRecurring && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.recurringDay}</p>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{t.dayOf} {d}.</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            {t.cancel}
          </button>
          <button onClick={handleSave} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors">
            {t.update}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────

function IncomeSummaryCard({ summary, t, lang }: { summary: any; t: any; lang: string }) {
  const items = [
    { label: t.workIncome,   amount: summary.work,        color: 'bg-blue-500',   textColor: 'text-blue-500' },
    { label: t.scholIncome,  amount: summary.scholarship, color: 'bg-purple-500', textColor: 'text-purple-500' },
    { label: t.pensIncome,   amount: summary.pension,     color: 'bg-orange-500', textColor: 'text-orange-500' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PieChart size={16} className="text-blue-500" />
        <span className="text-sm font-bold text-gray-900 dark:text-white">{t.summary}</span>
      </div>

      <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t.totalIncome}</p>
          <p className="text-2xl font-bold text-green-600">{formatAmount(summary.total)} ₺</p>
        </div>
        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
          <TrendingUp size={24} className="text-green-600" />
        </div>
      </div>

      {items.map((item) => {
        const percent = summary.total > 0 ? item.amount / summary.total : 0;
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(item.amount)} ₺</span>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md', item.textColor, 'bg-gray-100 dark:bg-gray-700')}>
                  %{(percent * 100).toFixed(0)}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
              <div className={cn('h-1.5 rounded-full transition-all', item.color)} style={{ width: `${(percent * 100).toFixed(0)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Recent Incomes ────────────────────────────────────────

function RecentIncomes({
  incomes, onDelete, onEdit, t, lang,
}: {
  incomes: Income[];
  onDelete: (i: Income) => void;
  onEdit: (i: Income) => void;
  t: any;
  lang: string;
}) {
  if (incomes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center">
        <Inbox size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.noIncome}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <History size={16} className="text-purple-500" />
        <span className="text-sm font-bold text-gray-900 dark:text-white">{t.recent}</span>
        <span className="text-xs text-gray-400 ml-auto">{incomes.length}</span>
      </div>

      <div className="space-y-1">
        {incomes.slice(0, 15).map((income, idx) => {
          const config = sourceConfig[income.source as IncomeSource] ??
            { color: 'text-gray-500', bgColor: 'bg-gray-500', icon: <User size={14} />, labelTr: income.source, labelEn: income.source };
          const isRec = (income as any).isRecurring;

          return (
            <div key={income.incomeId}>
              {idx > 0 && <hr className="border-gray-100 dark:border-gray-700" />}
              <div className="flex items-center gap-3 py-2 group">
                {/* Color bar */}
                <div className={cn('w-0.5 h-10 rounded-full', config.bgColor)} />

                {/* Icon */}
                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                  <span className={config.color}>{config.icon}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{income.source}</p>
                    {isRec && (
                      <span className="text-[9px] font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <RefreshCw size={8} />
                        {(income as any).day && `${(income as any).day}.`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {income.accountName} · {formatDateShort(income.date)}
                  </p>
                </div>

                {/* Amount */}
                <p className="text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0 tabular-nums">
                  {formatAmount(income.amount)} ₺
                </p>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(income)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDelete(income)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}