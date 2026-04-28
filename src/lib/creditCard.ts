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
  if (!value)
    return createLocalDate(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );

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

export function toLocalISOString(date: Date): string {
  return `${toDateInputValue(date)}T12:00:00.000Z`;
}

export function formatMonthYear(date: Date, locale = 'tr-TR') {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/**
 * Credit card billing cycle calculator.
 *
 * Real-world Turkish credit card flow:
 *   Previous period:  prevCutoff → currentPeriodStart - 1
 *   Statement closes: currentPeriodStart (= prevCutoff + 1 month)
 *   Statement due:    currentPeriodStart + GRACE_DAYS
 *   Current period:   currentPeriodStart → nextCutoff - 1
 *   Next statement:   nextCutoff
 *   Next due:         nextCutoff + GRACE_DAYS
 *
 * Example: cutoffDay=3, today=June 29
 *   previousPeriodStart = May 3
 *   currentPeriodStart  = June 3  (statement for May 3–June 2 closed here)
 *   statementDueDate    = June 13 (must pay May 3–June 2 expenses by this date)
 *   nextCutoffDate      = July 3
 *   nextDueDate         = July 13
 */
export function calculateCreditCardCycle(cutoffDay: number, now = new Date()) {
  const today = createLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthCutoff = createLocalDate(
    today.getFullYear(),
    today.getMonth(),
    cutoffDay
  );

  // Where are we relative to this month's cutoff?
  const currentPeriodStart =
    today >= thisMonthCutoff
      ? thisMonthCutoff
      : createLocalDate(today.getFullYear(), today.getMonth() - 1, cutoffDay);

  const nextCutoffDate =
    today >= thisMonthCutoff
      ? createLocalDate(today.getFullYear(), today.getMonth() + 1, cutoffDay)
      : thisMonthCutoff;

  const currentPeriodEndInclusive = addDays(nextCutoffDate, -1);

  // The PREVIOUS period whose statement is now due
  const previousPeriodStart = createLocalDate(
    currentPeriodStart.getFullYear(),
    currentPeriodStart.getMonth() - 1,
    cutoffDay
  );

  // Statement for the previous period closed at currentPeriodStart
  // Payment is due GRACE_DAYS after currentPeriodStart
  const statementCutoffDate = currentPeriodStart;
  const statementDueDate = addDays(currentPeriodStart, CREDIT_CARD_GRACE_DAYS);

  // Next cycle's due
  const nextDueDate = addDays(nextCutoffDate, CREDIT_CARD_GRACE_DAYS);

  return {
    previousPeriodStart,
    currentPeriodStart,
    currentPeriodEndInclusive,
    statementCutoffDate,
    statementDueDate,
    nextCutoffDate,
    nextDueDate,
  };
}

export function isDateInRangeInclusive(
  date: Date,
  start?: string,
  end?: string
) {
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

/**
 * Recalculates all credit card debt figures from transactions + payments.
 *
 * previousDebt = expenses from BEFORE currentPeriodStart minus payments
 *   → This is the "statement debt" that's due by statementDueDate
 * remainingDebt = expenses in the current period (not yet due)
 * totalDebt = previousDebt + remainingDebt
 */
export function recalculateCreditAccount(account: any, now = new Date()) {
  if (account.isDebit !== false) return account;

  const cycle = calculateCreditCardCycle(account.cutoffDate || 1, now);
  const allTx = account.transactions || [];
  const expenses = allTx.filter((t: any) => !t.isSurplus);
  const debtPayments = account.debtPayments || [];

  // Total expenses ever
  const totalExpenseGross = expenses.reduce(
    (s: number, t: any) => s + (t.amount ?? 0),
    0
  );

  // Total debt payments ever
  const totalPaid = debtPayments.reduce(
    (s: number, p: any) => s + (p.amount ?? 0),
    0
  );

  // Expenses from periods BEFORE the current one (= statement debt)
  const previousExpenseGross = expenses
    .filter(
      (t: any) => parseLocalDateInput(t.date) < cycle.currentPeriodStart
    )
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);

  // Expenses in the current period (not yet on any statement)
  const currentPeriodExpense = Math.max(
    totalExpenseGross - previousExpenseGross,
    0
  );

  // Apply payments: first to previous (statement) debt, overflow to current
  const paidToPrevious = Math.min(totalPaid, previousExpenseGross);
  const previousDebt = Math.max(previousExpenseGross - paidToPrevious, 0);

  const paidToCurrentOverflow = Math.max(totalPaid - previousExpenseGross, 0);
  const remainingDebt = Math.max(
    currentPeriodExpense - paidToCurrentOverflow,
    0
  );

  const totalDebt = previousDebt + remainingDebt;
  const creditLimit = account.creditLimit ?? 0;

  // Min payment based on statement debt if any, else total
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
    previousPeriodStart: toDateInputValue(cycle.previousPeriodStart),
    currentPeriodStart: toDateInputValue(cycle.currentPeriodStart),
    currentPeriodEnd: toDateInputValue(cycle.currentPeriodEndInclusive),
    currentCutoffDate: toDateInputValue(cycle.statementCutoffDate),
    currentDueDate: toDateInputValue(cycle.statementDueDate),
    nextCutoffDate: toDateInputValue(cycle.nextCutoffDate),
    nextDueDate: toDateInputValue(cycle.nextDueDate),
  };
}