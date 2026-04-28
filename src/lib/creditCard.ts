// src/lib/creditCard.ts
export const CREDIT_CARD_GRACE_DAYS = 10;

export function createLocalDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(day, lastDay));
  return new Date(year, monthIndex, safeDay, 12, 0, 0, 0);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function parseLocalDateInput(value?: string | Date | null) {
  if (!value) return createLocalDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  if (value instanceof Date) {
    return createLocalDate(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return createLocalDate(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(value);
  return createLocalDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatMonthYear(date: Date, locale = 'tr-TR') {
  return date.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

export function calculateCreditCardCycle(cutoffDay: number, now = new Date()) {
  const today = createLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthCutoff = createLocalDate(today.getFullYear(), today.getMonth(), cutoffDay);

  const currentPeriodStart =
    today >= thisMonthCutoff
      ? thisMonthCutoff
      : createLocalDate(today.getFullYear(), today.getMonth() - 1, cutoffDay);

  const nextCutoffDate =
    today >= thisMonthCutoff
      ? createLocalDate(today.getFullYear(), today.getMonth() + 1, cutoffDay)
      : thisMonthCutoff;

  const currentPeriodEndInclusive = addDays(nextCutoffDate, -1);

  // Statement cut at currentPeriodStart, due 10 days later
  const statementCutoffDate = currentPeriodStart;
  const statementDueDate = addDays(statementCutoffDate, CREDIT_CARD_GRACE_DAYS);

  // Upcoming next cycle
  const nextDueDate = addDays(nextCutoffDate, CREDIT_CARD_GRACE_DAYS);

  return {
    currentPeriodStart,
    currentPeriodEndInclusive,
    statementCutoffDate,
    statementDueDate,
    nextCutoffDate,
    nextDueDate,
  };
}

export function isDateInRangeInclusive(date: Date, start?: string, end?: string) {
  if (start) {
    const startDate = parseLocalDateInput(start);
    if (date < startDate) return false;
  }
  if (end) {
    const endDate = parseLocalDateInput(end);
    if (date > endDate) return false;
  }
  return true;
}

export function recalculateCreditAccount(account: any, now = new Date()) {
  if (account.isDebit !== false) return account;

  const cycle = calculateCreditCardCycle(account.cutoffDate || 1, now);
  const transactions = (account.transactions || []).filter((t: any) => !t.isSurplus);
  const debtPayments = account.debtPayments || [];

  const totalExpense = transactions.reduce((s: number, t: any) => s + (t.amount ?? 0), 0);
  const totalPaid = debtPayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

  const previousDebtGross = transactions
    .filter((t: any) => parseLocalDateInput(t.date) < cycle.currentPeriodStart)
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);

  const currentAndFutureDebtGross = Math.max(totalExpense - previousDebtGross, 0);

  const paidToPrevious = Math.min(totalPaid, previousDebtGross);
  const previousDebt = Math.max(previousDebtGross - paidToPrevious, 0);

  const paidLeft = Math.max(totalPaid - previousDebtGross, 0);
  const remainingDebt = Math.max(currentAndFutureDebtGross - paidLeft, 0);

  const totalDebt = previousDebt + remainingDebt;
  const creditLimit = account.creditLimit ?? 0;

  // If there is statement debt, min payment should be based on statement debt first.
  const minBase = previousDebt > 0 ? previousDebt : totalDebt;
  const minPayment = Math.max(minBase * 0.3, 0);

  return {
    ...account,
    debtPayments,
    totalDebt,
    currentDebt: totalDebt,
    previousDebt,
    remainingDebt,
    availableCredit: Math.max(creditLimit - totalDebt, 0),
    minPayment,
    remainingMinPayment: minPayment,
    currentCutoffDate: toDateInputValue(cycle.statementCutoffDate),
    currentDueDate: toDateInputValue(cycle.statementDueDate),
    nextCutoffDate: toDateInputValue(cycle.nextCutoffDate),
    nextDueDate: toDateInputValue(cycle.nextDueDate),
    currentPeriodStart: toDateInputValue(cycle.currentPeriodStart),
    currentPeriodEnd: toDateInputValue(cycle.currentPeriodEndInclusive),
  };
}