// src/components/home/DebtPaymentTracker.tsx
'use client';

import { useMemo, useState } from 'react';
import { formatAmount } from '@/lib/formatters';
import { useSettingsStore } from '@/store/settingsStore';
import { useTransactionStore } from '@/store/transactionStore';
import {
  CreditCard, Clock, AlertTriangle, XCircle,
  Eye, EyeOff, Bell, CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  calculateCreditCardCycle,
  toDateInputValue,
} from '@/lib/creditCard';

interface DebtPaymentTrackerProps {
  bankDataList: any[];
  isVisible: boolean;
  onToggleVisibility: () => void;
}

type DebtPhase = 'safe' | 'approaching' | 'pay_period' | 'due_today' | 'overdue';

interface CreditAccountInfo {
  accountId: number;
  bankId: number;
  bankName: string;
  accountName: string;
  creditLimit: number;
  totalDebt: number;
  minPayment: number;
  availableCredit: number;
  previousDebt: number;
  remainingDebt: number;
  cutoffDate: number;
  statementCutoffDate: Date;
  statementDueDate: Date;
  nextCutoffDate: Date;
  nextDueDate: Date;
  phase: DebtPhase;
  daysUntilDue: number;
  daysUntilNextCutoff: number;
  transactions: any[];
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Phase is determined by:
 * 1. Is there unpaid previous statement debt (previousDebt > 0)?
 * 2. Where are we relative to statementDueDate?
 *
 * If previousDebt === 0 → always 'safe' (nothing to pay)
 * If previousDebt > 0:
 *   - past due date → overdue
 *   - today is due date → due_today
 *   - between cutoff and due → pay_period
 *   - within 7 days of cutoff → approaching
 *   - else → safe
 */
function getPhase(now: Date, acc: { previousDebt: number; statementCutoffDate: Date; statementDueDate: Date; daysUntilNextCutoff: number }): DebtPhase {
  // No statement debt → nothing to worry about
  if (acc.previousDebt <= 0) {
    if (acc.daysUntilNextCutoff <= 7 && acc.daysUntilNextCutoff > 0) return 'approaching';
    return 'safe';
  }

  // Has statement debt — check urgency
  if (now > acc.statementDueDate && !sameDay(now, acc.statementDueDate)) return 'overdue';
  if (sameDay(now, acc.statementDueDate)) return 'due_today';
  if (now >= acc.statementCutoffDate) return 'pay_period';

  return 'safe';
}

const PHASE_CONFIG: Record<DebtPhase, {
  label: { tr: string; en: string };
  description: { tr: string; en: string };
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  badgeColor: string;
  icon: React.ReactNode;
  pulse: boolean;
}> = {
  safe: {
    label:       { tr: 'Güvenli', en: 'Safe' },
    description: { tr: 'Ödeme günü uzak veya borç yok', en: 'No debt or payment day is far' },
    bgColor:     'bg-green-50 dark:bg-green-900/10',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor:   'text-green-700 dark:text-green-400',
    iconColor:   'text-green-500',
    badgeColor:  'bg-green-100 dark:bg-green-900/30 text-green-700',
    icon:        <CheckCircle size={18} />,
    pulse:       false,
  },
  approaching: {
    label:       { tr: 'Yaklaşıyor', en: 'Approaching' },
    description: { tr: 'Hesap kesim günü yakın', en: 'Cutoff date is near' },
    bgColor:     'bg-yellow-50 dark:bg-yellow-900/10',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    textColor:   'text-yellow-700 dark:text-yellow-400',
    iconColor:   'text-yellow-500',
    badgeColor:  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700',
    icon:        <Clock size={18} />,
    pulse:       false,
  },
  pay_period: {
    label:       { tr: 'Ödeme Dönemi', en: 'Payment Period' },
    description: { tr: 'Ekstre borcunu ödeyin', en: 'Pay your statement' },
    bgColor:     'bg-orange-50 dark:bg-orange-900/10',
    borderColor: 'border-orange-300 dark:border-orange-700',
    textColor:   'text-orange-700 dark:text-orange-400',
    iconColor:   'text-orange-500',
    badgeColor:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700',
    icon:        <AlertTriangle size={18} />,
    pulse:       true,
  },
  due_today: {
    label:       { tr: 'BUGÜN SON GÜN!', en: 'DUE TODAY!' },
    description: { tr: 'Ekstreyi bugün ödeyin', en: 'Pay statement today' },
    bgColor:     'bg-red-50 dark:bg-red-900/10',
    borderColor: 'border-red-400 dark:border-red-700',
    textColor:   'text-red-700 dark:text-red-400',
    iconColor:   'text-red-500',
    badgeColor:  'bg-red-100 dark:bg-red-900/30 text-red-700',
    icon:        <XCircle size={18} />,
    pulse:       true,
  },
  overdue: {
    label:       { tr: 'GECİKMİŞ!', en: 'OVERDUE!' },
    description: { tr: 'Son ödeme tarihi geçti!', en: 'Due date passed!' },
    bgColor:     'bg-red-100 dark:bg-red-900/20',
    borderColor: 'border-red-500 dark:border-red-600',
    textColor:   'text-red-800 dark:text-red-300',
    iconColor:   'text-red-600',
    badgeColor:  'bg-red-200 dark:bg-red-900/40 text-red-800',
    icon:        <XCircle size={18} />,
    pulse:       true,
  },
};

export function DebtPaymentTracker({
  bankDataList,
  isVisible,
  onToggleVisibility,
}: DebtPaymentTrackerProps) {
  const { language } = useSettingsStore();
  const { payCreditCardDebt } = useTransactionStore();
  const lang = language || 'tr';

  const [customAccount, setCustomAccount] = useState<CreditAccountInfo | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const t = {
    title:         lang === 'tr' ? 'Kredi Kartı Durumu' : 'Credit Card Status',
    totalDebt:     lang === 'tr' ? 'Toplam Borç' : 'Total Debt',
    minPayment:    lang === 'tr' ? 'Asgari Ödeme' : 'Min. Payment',
    available:     lang === 'tr' ? 'Kullanılabilir' : 'Available',
    statement:     lang === 'tr' ? 'Ekstre Borcu' : 'Statement Debt',
    currentPeriod: lang === 'tr' ? 'Dönem Borcu' : 'Current Period',
    dueDate:       lang === 'tr' ? 'Son Ödeme' : 'Due Date',
    nextCutoff:    lang === 'tr' ? 'Sonraki Kesim' : 'Next Cutoff',
    daysLeft:      lang === 'tr' ? 'gün kaldı' : 'days left',
    today:         lang === 'tr' ? 'Bugün!' : 'Today!',
    passed:        lang === 'tr' ? 'gün geçti' : 'days ago',
    limit:         lang === 'tr' ? 'Limit' : 'Limit',
    debt:          lang === 'tr' ? 'Borç' : 'Debt',
    minPay:        lang === 'tr' ? 'Asgari' : 'Min.',
    payMin:        lang === 'tr' ? 'Asgariyi Öde' : 'Pay Min',
    payStatement:  lang === 'tr' ? 'Ekstreyi Öde' : 'Pay Statement',
    payAll:        lang === 'tr' ? 'Tümünü Öde' : 'Pay All',
    custom:        lang === 'tr' ? 'Özel Tutar' : 'Custom',
    noPrevDebt:    lang === 'tr' ? 'Ekstre borcu yok' : 'No statement debt',
  };

  const creditAccounts: CreditAccountInfo[] = useMemo(() => {
    const now = new Date();
    const accounts: CreditAccountInfo[] = [];

    bankDataList.forEach((bank: any) => {
      (bank.accounts ?? []).forEach((acc: any) => {
        if (acc.isDebit !== false) return;

        const cycle = calculateCreditCardCycle(acc.cutoffDate || 1, now);
        const daysUntilDue = daysBetween(now, cycle.statementDueDate);
        const daysUntilNextCutoff = daysBetween(now, cycle.nextCutoffDate);

        const temp: CreditAccountInfo = {
          accountId: acc.accountId,
          bankId: bank.bankId,
          bankName: bank.bankName,
          accountName: acc.name,
          creditLimit: acc.creditLimit ?? 0,
          totalDebt: acc.totalDebt ?? 0,
          minPayment: acc.minPayment ?? 0,
          availableCredit: acc.availableCredit ?? 0,
          previousDebt: acc.previousDebt ?? 0,
          remainingDebt: acc.remainingDebt ?? 0,
          cutoffDate: acc.cutoffDate || 1,
          statementCutoffDate: cycle.statementCutoffDate,
          statementDueDate: cycle.statementDueDate,
          nextCutoffDate: cycle.nextCutoffDate,
          nextDueDate: cycle.nextDueDate,
          phase: 'safe',
          daysUntilDue,
          daysUntilNextCutoff,
          transactions: acc.transactions ?? [],
        };

        temp.phase = getPhase(now, temp);
        accounts.push(temp);
      });
    });

    const phaseOrder: Record<DebtPhase, number> = {
      overdue: 0, due_today: 1, pay_period: 2, approaching: 3, safe: 4,
    };
    accounts.sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);

    return accounts;
  }, [bankDataList]);

  if (creditAccounts.length === 0) return null;

  const hasUrgent = creditAccounts.some(
    (a) => a.phase === 'overdue' || a.phase === 'due_today' || a.phase === 'pay_period'
  );

  const totalDebt = creditAccounts.reduce((s, a) => s + a.totalDebt, 0);
  const totalMinPayment = creditAccounts.reduce((s, a) => s + a.minPayment, 0);
  const totalAvailable = creditAccounts.reduce((s, a) => s + a.availableCredit, 0);

  const handlePay = async (
    account: CreditAccountInfo,
    amount: number,
    date?: string,
    note?: string
  ) => {
    if (!amount || amount <= 0) return;
    try {
      setIsPaying(true);
      await payCreditCardDebt(account.accountId, account.bankId, amount, date, note);
      toast.success(lang === 'tr' ? 'Borç ödemesi kaydedildi' : 'Debt payment saved');
      setCustomAccount(null);
    } catch {
      toast.error(lang === 'tr' ? 'Borç ödemesi kaydedilemedi' : 'Failed to save');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      {hasUrgent && <UrgentBanner accounts={creditAccounts} lang={lang} />}

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-red-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t.title}</h2>
            {hasUrgent && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
          </div>
          <button
            onClick={onToggleVisibility}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isVisible ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
          </button>
        </div>

        {isVisible && (
          <>
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-gray-100 dark:border-gray-700">
              <SummaryMini label={t.totalDebt} amount={totalDebt} color="red" />
              <SummaryMini label={t.minPayment} amount={totalMinPayment} color="orange" />
              <SummaryMini label={t.available} amount={totalAvailable} color="blue" />
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {creditAccounts.map((acc) => (
                <CreditCardRow
                  key={acc.accountId}
                  account={acc}
                  lang={lang}
                  t={t}
                  onPayMin={() => handlePay(acc, acc.minPayment)}
                  onPayStatement={() => handlePay(acc, acc.previousDebt)}
                  onPayAll={() => handlePay(acc, acc.totalDebt)}
                  onCustom={() => setCustomAccount(acc)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {customAccount && (
        <DebtPaymentModal
          account={customAccount}
          lang={lang}
          isSubmitting={isPaying}
          onClose={() => setCustomAccount(null)}
          onSubmit={handlePay}
        />
      )}
    </div>
  );
}

function UrgentBanner({ accounts, lang }: { accounts: CreditAccountInfo[]; lang: string }) {
  const urgent = accounts.filter(
    (a) => a.phase === 'overdue' || a.phase === 'due_today' || a.phase === 'pay_period'
  );
  if (urgent.length === 0) return null;

  const mostUrgent = urgent[0];
  const config = PHASE_CONFIG[mostUrgent.phase];

  return (
    <div className={cn('rounded-2xl border-2 p-4', config.bgColor, config.borderColor, config.pulse && 'animate-pulse')}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex-shrink-0', config.iconColor)}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold', config.textColor)}>
            {config.label[lang as 'tr' | 'en']}
          </p>
          <p className={cn('text-xs mt-0.5', config.textColor, 'opacity-80')}>
            {config.description[lang as 'tr' | 'en']}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {urgent.map((acc) => (
              <span
                key={acc.accountId}
                className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg', config.badgeColor)}
              >
                {acc.bankName} — {formatAmount(acc.previousDebt)}₺ ekstre
              </span>
            ))}
          </div>
        </div>
        <Bell size={16} className={cn(config.iconColor, config.pulse && 'animate-bounce')} />
      </div>
    </div>
  );
}

function CreditCardRow({
  account, lang, t,
  onPayMin, onPayStatement, onPayAll, onCustom,
}: {
  account: CreditAccountInfo;
  lang: string;
  t: any;
  onPayMin: () => void;
  onPayStatement: () => void;
  onPayAll: () => void;
  onCustom: () => void;
}) {
  const config = PHASE_CONFIG[account.phase];

  const formatD = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;

  const dueDisplay = (() => {
    if (account.previousDebt <= 0) return lang === 'tr' ? 'Borç yok' : 'No debt';
    if (account.daysUntilDue === 0) return lang === 'tr' ? 'Bugün!' : 'Today!';
    if (account.daysUntilDue < 0) return `${Math.abs(account.daysUntilDue)} ${lang === 'tr' ? 'gün geçti' : 'days ago'}`;
    return `${account.daysUntilDue} ${t.daysLeft}`;
  })();

  const nextCutoffDisplay = (() => {
    if (account.daysUntilNextCutoff === 0) return lang === 'tr' ? 'Bugün!' : 'Today!';
    return `${account.daysUntilNextCutoff} ${t.daysLeft}`;
  })();

  const usagePercent = account.creditLimit > 0 ? (account.totalDebt / account.creditLimit) * 100 : 0;
  const usageColor = usagePercent >= 80 ? 'bg-red-500' : usagePercent >= 50 ? 'bg-orange-500' : 'bg-green-500';

  return (
    <div className="p-5 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', config.bgColor)}>
            <CreditCard size={18} className={config.iconColor} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{account.bankName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{account.accountName}</p>
          </div>
        </div>
        <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold', config.badgeColor, config.pulse && 'animate-pulse')}>
          <span className={config.iconColor}>{config.icon}</span>
          {config.label[lang as 'tr' | 'en']}
        </div>
      </div>

      {/* Usage bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">{t.limit}: {formatAmount(account.creditLimit)}₺</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            %{usagePercent.toFixed(0)} {lang === 'tr' ? 'kullanıldı' : 'used'}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all duration-500', usageColor)}
            style={{ width: `${Math.min(usagePercent, 100).toFixed(0)}%` }}
          />
        </div>
      </div>

      {/* Debt info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <InfoCell
          label={t.statement}
          value={`${formatAmount(account.previousDebt)}₺`}
          highlight={account.previousDebt > 0}
        />
        <InfoCell
          label={t.currentPeriod}
          value={`${formatAmount(account.remainingDebt)}₺`}
        />
        <InfoCell
          label={t.debt}
          value={`${formatAmount(account.totalDebt)}₺`}
          highlight={account.totalDebt > 0}
        />
        <InfoCell
          label={t.available}
          value={`${formatAmount(account.availableCredit)}₺`}
        />
      </div>

      {/* Date timeline */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <DateCell
          label={account.previousDebt > 0
            ? (lang === 'tr' ? 'Ekstre Son Ödeme' : 'Statement Due')
            : t.dueDate}
          date={formatD(account.statementDueDate)}
          daysText={dueDisplay}
          phase={account.phase}
          lang={lang}
          isUrgent={account.previousDebt > 0 && (account.phase === 'pay_period' || account.phase === 'due_today' || account.phase === 'overdue')}
        />
        <DateCell
          label={t.nextCutoff}
          date={formatD(account.nextCutoffDate)}
          daysText={nextCutoffDisplay}
          phase={account.daysUntilNextCutoff <= 3 ? 'approaching' : 'safe'}
          lang={lang}
        />
      </div>

      {/* Payment buttons — only show when there's debt */}
      {account.totalDebt > 0 && (
        <div className="flex flex-wrap gap-2">
          {account.minPayment > 0 && (
            <button onClick={onPayMin} className="px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
              {t.payMin} ({formatAmount(account.minPayment)}₺)
            </button>
          )}
          {account.previousDebt > 0 && (
            <button onClick={onPayStatement} className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              {t.payStatement} ({formatAmount(account.previousDebt)}₺)
            </button>
          )}
          <button onClick={onPayAll} className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
            {t.payAll} ({formatAmount(account.totalDebt)}₺)
          </button>
          <button onClick={onCustom} className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
            {t.custom}
          </button>
        </div>
      )}

      {account.totalDebt === 0 && (
        <p className="text-xs text-green-600 font-semibold">
          ✓ {lang === 'tr' ? 'Borç yok' : 'No debt'}
        </p>
      )}
    </div>
  );
}

function DebtPaymentModal({
  account, lang, isSubmitting, onClose, onSubmit,
}: {
  account: CreditAccountInfo;
  lang: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (account: CreditAccountInfo, amount: number, date?: string, note?: string) => void;
}) {
  const [amount, setAmount] = useState(
    String(account.previousDebt > 0 ? account.previousDebt : account.totalDebt)
  );
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [note, setNote] = useState('');

  const maxPayable = account.totalDebt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {lang === 'tr' ? 'Borç Ödemesi' : 'Debt Payment'}
        </h3>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1">
          <p className="text-xs text-gray-400">{account.bankName} — {account.accountName}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-gray-400">{lang === 'tr' ? 'Ekstre Borcu' : 'Statement'}</p>
              <p className="text-sm font-bold text-red-500">{formatAmount(account.previousDebt)}₺</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">{lang === 'tr' ? 'Toplam Borç' : 'Total'}</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatAmount(account.totalDebt)}₺</p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
            {lang === 'tr' ? 'Ödeme Tutarı' : 'Amount'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            max={maxPayable}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {Number(amount) > maxPayable && (
            <p className="text-[10px] text-red-500 mt-1">
              {lang === 'tr' ? `Maksimum: ${formatAmount(maxPayable)}₺` : `Max: ${formatAmount(maxPayable)}₺`}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
            {lang === 'tr' ? 'Tarih' : 'Date'}
          </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">
            {lang === 'tr' ? 'Not' : 'Note'}
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={lang === 'tr' ? 'Opsiyonel' : 'Optional'} />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400">
            {lang === 'tr' ? 'İptal' : 'Cancel'}
          </button>
          <button
            disabled={isSubmitting || !Number(amount) || Number(amount) <= 0}
            onClick={() => onSubmit(account, Math.min(Number(amount) || 0, maxPayable), date, note)}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
            {isSubmitting
              ? (lang === 'tr' ? 'Kaydediliyor…' : 'Saving…')
              : (lang === 'tr' ? 'Öde' : 'Pay')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryMini({ label, amount, color }: { label: string; amount: number; color: string }) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-50 dark:bg-red-900/10 text-red-600',
    orange: 'bg-orange-50 dark:bg-orange-900/10 text-orange-600',
    blue: 'bg-blue-50 dark:bg-blue-900/10 text-blue-600',
  };
  return (
    <div className={cn('rounded-xl p-3 text-center', colorMap[color])}>
      <p className="text-[10px] opacity-70 mb-0.5">{label}</p>
      <p className="text-sm font-bold">{formatAmount(amount)} ₺</p>
    </div>
  );
}

function InfoCell({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5">
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className={cn('text-xs font-bold', highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white')}>
        {value}
      </p>
    </div>
  );
}

function DateCell({
  label, date, daysText, phase, lang, isUrgent = false,
}: {
  label: string; date: string; daysText: string; phase: DebtPhase; lang: string; isUrgent?: boolean;
}) {
  const config = PHASE_CONFIG[phase];
  return (
    <div className={cn(
      'rounded-xl p-3 border',
      isUrgent ? config.bgColor : 'bg-gray-50 dark:bg-gray-700/50',
      isUrgent ? config.borderColor : 'border-transparent'
    )}>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className={cn('text-sm font-bold mt-1', isUrgent ? config.textColor : 'text-gray-900 dark:text-white')}>
        {date}
      </p>
      <p className={cn('text-[10px] font-semibold mt-0.5', isUrgent ? config.textColor : 'text-gray-500')}>
        {daysText}
      </p>
    </div>
  );
}