'use client';

import { useMemo } from 'react';
import { formatAmount } from '@/lib/formatters';
import { useSettingsStore } from '@/store/settingsStore';
import {
  CreditCard, Clock, AlertTriangle, XCircle,
  Calendar, ChevronRight, Eye, EyeOff, Bell,
  Shield, TrendingDown, CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebtPaymentTrackerProps {
  bankDataList: any[];
  isVisible: boolean;
  onToggleVisibility: () => void;
}

type DebtPhase = 'safe' | 'approaching' | 'pay_period' | 'due_today' | 'overdue';

interface CreditAccountInfo {
  accountId: number;
  bankName: string;
  accountName: string;
  creditLimit: number;
  totalDebt: number;
  minPayment: number;
  availableCredit: number;
  previousDebt: number;
  remainingDebt: number;
  cutoffDate: number;
  nextCutoffDate: Date;
  nextDueDate: Date;
  previousCutoffDate: Date;
  previousDueDate: Date;
  phase: DebtPhase;
  daysUntilCutoff: number;
  daysUntilDue: number;
  transactions: any[];
}

// ── Date calculation helpers ──────────────────────────────

function getActualCutoffDate(year: number, month: number, cutoffDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(cutoffDay, lastDay);
  let date = new Date(year, month, day);
  // Skip weekends
  while (date.getDay() === 0 || date.getDay() === 6) {
    date = new Date(date.getTime() + 86400000);
  }
  return date;
}

function calculateCreditDates(cutoffDay: number, now: Date) {
  const thisMonthCutoff = getActualCutoffDate(now.getFullYear(), now.getMonth(), cutoffDay);

  let previousCutoffDate: Date;
  let nextCutoffDate: Date;

  if (now < thisMonthCutoff) {
    // Still in previous period
    previousCutoffDate = getActualCutoffDate(now.getFullYear(), now.getMonth() - 1, cutoffDay);
    nextCutoffDate = thisMonthCutoff;
  } else {
    // New period started
    previousCutoffDate = thisMonthCutoff;
    nextCutoffDate = getActualCutoffDate(now.getFullYear(), now.getMonth() + 1, cutoffDay);
  }

  // Due date is typically 10 days after cutoff
  const previousDueDate = new Date(previousCutoffDate);
  previousDueDate.setDate(previousDueDate.getDate() + 10);
  const nextDueDate = new Date(nextCutoffDate);
  nextDueDate.setDate(nextDueDate.getDate() + 10);

  return { previousCutoffDate, nextCutoffDate, previousDueDate, nextDueDate };
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function getPhase(now: Date, nextCutoffDate: Date, nextDueDate: Date, previousDueDate: Date): DebtPhase {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cutoff = new Date(nextCutoffDate.getFullYear(), nextCutoffDate.getMonth(), nextCutoffDate.getDate());
  const due = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth(), nextDueDate.getDate());
  const prevDue = new Date(previousDueDate.getFullYear(), previousDueDate.getMonth(), previousDueDate.getDate());

  // Check if past due date
  if (today > due) return 'overdue';

  // Check if today is due date
  if (today.getTime() === due.getTime()) return 'due_today';

  // Check if in pay period (between cutoff and due date)
  if (today >= cutoff && today < due) return 'pay_period';

  // Check if approaching (within 7 days of cutoff)
  const daysToC = daysBetween(today, cutoff);
  if (daysToC <= 7 && daysToC > 0) return 'approaching';

  return 'safe';
}

// ── Phase styling config ──────────────────────────────────

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
    label:       { tr: 'Güvenli',          en: 'Safe' },
    description: { tr: 'Ödeme günü uzak',  en: 'Payment day is far' },
    bgColor:     'bg-green-50 dark:bg-green-900/10',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor:   'text-green-700 dark:text-green-400',
    iconColor:   'text-green-500',
    badgeColor:  'bg-green-100 dark:bg-green-900/30 text-green-700',
    icon:        <CheckCircle size={18} />,
    pulse:       false,
  },
  approaching: {
    label:       { tr: 'Yaklaşıyor',              en: 'Approaching' },
    description: { tr: 'Hesap kesim günü yakın',   en: 'Cutoff date is near' },
    bgColor:     'bg-yellow-50 dark:bg-yellow-900/10',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    textColor:   'text-yellow-700 dark:text-yellow-400',
    iconColor:   'text-yellow-500',
    badgeColor:  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700',
    icon:        <Clock size={18} />,
    pulse:       false,
  },
  pay_period: {
    label:       { tr: 'Ödeme Dönemi',                  en: 'Payment Period' },
    description: { tr: 'Son ödeme tarihine kadar ödeyin', en: 'Pay before due date' },
    bgColor:     'bg-orange-50 dark:bg-orange-900/10',
    borderColor: 'border-orange-300 dark:border-orange-700',
    textColor:   'text-orange-700 dark:text-orange-400',
    iconColor:   'text-orange-500',
    badgeColor:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700',
    icon:        <AlertTriangle size={18} />,
    pulse:       true,
  },
  due_today: {
    label:       { tr: 'BUGÜN SON GÜN!',           en: 'DUE TODAY!' },
    description: { tr: 'Hemen ödeme yapın!',         en: 'Pay immediately!' },
    bgColor:     'bg-red-50 dark:bg-red-900/10',
    borderColor: 'border-red-400 dark:border-red-700',
    textColor:   'text-red-700 dark:text-red-400',
    iconColor:   'text-red-500',
    badgeColor:  'bg-red-100 dark:bg-red-900/30 text-red-700',
    icon:        <XCircle size={18} />,
    pulse:       true,
  },
  overdue: {
    label:       { tr: 'GECİKMİŞ!',                               en: 'OVERDUE!' },
    description: { tr: 'Son ödeme tarihi geçti! Acil ödeme yapın.', en: 'Due date has passed! Pay urgently.' },
    bgColor:     'bg-red-100 dark:bg-red-900/20',
    borderColor: 'border-red-500 dark:border-red-600',
    textColor:   'text-red-800 dark:text-red-300',
    iconColor:   'text-red-600',
    badgeColor:  'bg-red-200 dark:bg-red-900/40 text-red-800',
    icon:        <XCircle size={18} />,
    pulse:       true,
  },
};

// ── Main Component ────────────────────────────────────────

export function DebtPaymentTracker({
  bankDataList,
  isVisible,
  onToggleVisibility,
}: DebtPaymentTrackerProps) {
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  const t = {
    title:           lang === 'tr' ? 'Kredi Kartı Durumu' : 'Credit Card Status',
    totalDebt:       lang === 'tr' ? 'Toplam Borç' : 'Total Debt',
    minPayment:      lang === 'tr' ? 'Asgari Ödeme' : 'Min. Payment',
    available:       lang === 'tr' ? 'Kullanılabilir' : 'Available',
    cutoffDate:      lang === 'tr' ? 'Hesap Kesim' : 'Cutoff Date',
    dueDate:         lang === 'tr' ? 'Son Ödeme' : 'Due Date',
    daysLeft:        lang === 'tr' ? 'gün kaldı' : 'days left',
    today:           lang === 'tr' ? 'Bugün!' : 'Today!',
    passed:          lang === 'tr' ? 'gün geçti' : 'days ago',
    limit:           lang === 'tr' ? 'Limit' : 'Limit',
    debt:            lang === 'tr' ? 'Borç' : 'Debt',
    minPay:          lang === 'tr' ? 'Asgari' : 'Min.',
    remaining:       lang === 'tr' ? 'Kalan' : 'Remaining',
    noCards:         lang === 'tr' ? 'Kredi kartı bulunamadı' : 'No credit cards found',
    urgentPayment:   lang === 'tr' ? 'Acil ödeme gerekiyor!' : 'Urgent payment needed!',
    paymentReminder: lang === 'tr' ? 'Ödeme hatırlatma' : 'Payment reminder',
  };

  // Process all credit card accounts
  const creditAccounts: CreditAccountInfo[] = useMemo(() => {
    const now = new Date();
    const accounts: CreditAccountInfo[] = [];

    bankDataList.forEach((bank: any) => {
      (bank.accounts ?? []).forEach((acc: any) => {
        if (acc.isDebit !== false) return; // Only credit cards

        const cutoffDay = acc.cutoffDate || 1;
        const dates = calculateCreditDates(cutoffDay, now);
        const phase = getPhase(now, dates.nextCutoffDate, dates.nextDueDate, dates.previousDueDate);
        const daysUntilCutoff = daysBetween(now, dates.nextCutoffDate);
        const daysUntilDue = daysBetween(now, dates.nextDueDate);

        accounts.push({
          accountId: acc.accountId,
          bankName: bank.bankName,
          accountName: acc.name,
          creditLimit: acc.creditLimit ?? 0,
          totalDebt: acc.totalDebt ?? 0,
          minPayment: acc.minPayment ?? 0,
          availableCredit: acc.availableCredit ?? 0,
          previousDebt: acc.previousDebt ?? 0,
          remainingDebt: acc.remainingDebt ?? 0,
          cutoffDate: cutoffDay,
          nextCutoffDate: dates.nextCutoffDate,
          nextDueDate: dates.nextDueDate,
          previousCutoffDate: dates.previousCutoffDate,
          previousDueDate: dates.previousDueDate,
          phase,
          daysUntilCutoff,
          daysUntilDue,
          transactions: acc.transactions ?? [],
        });
      });
    });

    // Sort: most urgent first
    const phaseOrder: Record<DebtPhase, number> = {
      overdue: 0, due_today: 1, pay_period: 2, approaching: 3, safe: 4,
    };
    accounts.sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);

    return accounts;
  }, [bankDataList]);

  if (creditAccounts.length === 0) return null;

  // Check if there are urgent cards
  const hasUrgent = creditAccounts.some(
    (a) => a.phase === 'overdue' || a.phase === 'due_today' || a.phase === 'pay_period'
  );

  const totalDebt = creditAccounts.reduce((s, a) => s + a.totalDebt, 0);
  const totalMinPayment = creditAccounts.reduce((s, a) => s + a.minPayment, 0);
  const totalAvailable = creditAccounts.reduce((s, a) => s + a.availableCredit, 0);

  return (
    <div className="space-y-4">
      {/* ── Urgent Alert Banner ── */}
      {hasUrgent && (
        <UrgentBanner accounts={creditAccounts} lang={lang} t={t} />
      )}

      {/* ── Main Card ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
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
            {isVisible
              ? <EyeOff size={14} className="text-gray-400" />
              : <Eye size={14} className="text-gray-400" />}
          </button>
        </div>

        {isVisible && (
          <>
            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-gray-100 dark:border-gray-700">
              <SummaryMini label={t.totalDebt}  amount={totalDebt}      color="red" />
              <SummaryMini label={t.minPayment} amount={totalMinPayment} color="orange" />
              <SummaryMini label={t.available}  amount={totalAvailable}  color="blue" />
            </div>

            {/* Individual Cards */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {creditAccounts.map((acc) => (
                <CreditCardRow key={acc.accountId} account={acc} lang={lang} t={t} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Urgent Banner ─────────────────────────────────────────

function UrgentBanner({ accounts, lang, t }: { accounts: CreditAccountInfo[]; lang: string; t: any }) {
  const urgent = accounts.filter(
    (a) => a.phase === 'overdue' || a.phase === 'due_today' || a.phase === 'pay_period'
  );

  const mostUrgent = urgent[0];
  const config = PHASE_CONFIG[mostUrgent.phase];

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4',
      config.bgColor, config.borderColor,
      config.pulse && 'animate-pulse'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex-shrink-0', config.iconColor)}>
          {config.icon}
        </div>
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
                {acc.bankName} — {formatAmount(acc.totalDebt)}₺
                {acc.phase === 'overdue' && ` (${Math.abs(acc.daysUntilDue)} ${lang === 'tr' ? 'gün geçti' : 'days late'})`}
                {acc.phase === 'due_today' && ` (${lang === 'tr' ? 'BUGÜN!' : 'TODAY!'})`}
                {acc.phase === 'pay_period' && ` (${acc.daysUntilDue} ${t.daysLeft})`}
              </span>
            ))}
          </div>
        </div>
        <Bell size={16} className={cn(config.iconColor, config.pulse && 'animate-bounce')} />
      </div>
    </div>
  );
}

// ── Credit Card Row ───────────────────────────────────────

function CreditCardRow({ account, lang, t }: { account: CreditAccountInfo; lang: string; t: any }) {
  const config = PHASE_CONFIG[account.phase];
  const now = new Date();

  // Format dates
  const formatD = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  // Days display
  const cutoffDisplay = (() => {
    if (account.daysUntilCutoff === 0) return t.today;
    if (account.daysUntilCutoff < 0) return `${Math.abs(account.daysUntilCutoff)} ${t.passed}`;
    return `${account.daysUntilCutoff} ${t.daysLeft}`;
  })();

  const dueDisplay = (() => {
    if (account.daysUntilDue === 0) return t.today;
    if (account.daysUntilDue < 0) return `${Math.abs(account.daysUntilDue)} ${t.passed}`;
    return `${account.daysUntilDue} ${t.daysLeft}`;
  })();

  // Usage percentage
  const usagePercent = account.creditLimit > 0
    ? (account.totalDebt / account.creditLimit) * 100
    : 0;

  const usageColor = usagePercent >= 80
    ? 'bg-red-500'
    : usagePercent >= 50
      ? 'bg-orange-500'
      : 'bg-green-500';

  return (
    <div className="p-5 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            config.bgColor
          )}>
            <CreditCard size={18} className={config.iconColor} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {account.bankName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {account.accountName}
            </p>
          </div>
        </div>

        {/* Phase Badge */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold',
          config.badgeColor,
          config.pulse && 'animate-pulse'
        )}>
          <span className={config.iconColor}>
            {config.icon}
          </span>
          {config.label[lang as 'tr' | 'en']}
        </div>
      </div>

      {/* Credit Usage Bar */}
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

      {/* Debt + Payment Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <InfoCell label={t.debt}      value={`${formatAmount(account.totalDebt)}₺`}     highlight={account.totalDebt > 0} />
        <InfoCell label={t.minPay}    value={`${formatAmount(account.minPayment)}₺`}    />
        <InfoCell label={t.remaining} value={`${formatAmount(account.availableCredit)}₺`} />
        <InfoCell label={t.limit}     value={`${formatAmount(account.creditLimit)}₺`}   />
      </div>

      {/* Date Timeline */}
      <div className="grid grid-cols-2 gap-2">
        {/* Cutoff Date */}
        <DateCell
          label={t.cutoffDate}
          date={formatD(account.nextCutoffDate)}
          daysText={cutoffDisplay}
          phase={account.daysUntilCutoff <= 3 ? 'approaching' : 'safe'}
          lang={lang}
        />

        {/* Due Date */}
        <DateCell
          label={t.dueDate}
          date={formatD(account.nextDueDate)}
          daysText={dueDisplay}
          phase={account.phase}
          lang={lang}
          isUrgent={account.phase === 'pay_period' || account.phase === 'due_today' || account.phase === 'overdue'}
        />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function SummaryMini({ label, amount, color }: { label: string; amount: number; color: string }) {
  const colorMap: Record<string, string> = {
    red:    'bg-red-50 dark:bg-red-900/10 text-red-600',
    orange: 'bg-orange-50 dark:bg-orange-900/10 text-orange-600',
    blue:   'bg-blue-50 dark:bg-blue-900/10 text-blue-600',
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
      <p className={cn(
        'text-xs font-bold',
        highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
      )}>
        {value}
      </p>
    </div>
  );
}

function DateCell({
  label, date, daysText, phase, lang, isUrgent = false,
}: {
  label: string;
  date: string;
  daysText: string;
  phase: DebtPhase;
  lang: string;
  isUrgent?: boolean;
}) {
  const config = PHASE_CONFIG[phase];

  return (
    <div className={cn(
      'rounded-xl p-3 border',
      isUrgent ? config.bgColor : 'bg-gray-50 dark:bg-gray-700/50',
      isUrgent ? config.borderColor : 'border-transparent'
    )}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-gray-400">{label}</p>
        {isUrgent && (
          <span className={cn(config.iconColor, 'scale-75')}>
            {config.icon}
          </span>
        )}
      </div>
      <p className={cn(
        'text-sm font-bold',
        isUrgent ? config.textColor : 'text-gray-900 dark:text-white'
      )}>
        {date}
      </p>
      <p className={cn(
        'text-[10px] font-semibold mt-0.5',
        isUrgent ? config.textColor : 'text-gray-500'
      )}>
        {daysText}
      </p>
    </div>
  );
}