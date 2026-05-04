export function recalculateCreditAccount(account: any, now = new Date()) {
  if (account.isDebit !== false) return account;

  const cycle = calculateCreditCardCycle(account.cutoffDate || 1, now);
  const allTx = account.transactions || [];

  const expenses = allTx.filter(
    (t: any) => !t.isSurplus && !t.isInstallmentPaid
  );

  const debtPayments = account.debtPayments || [];

  // Total expenses (only unpaid)
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
  // Also only unpaid
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