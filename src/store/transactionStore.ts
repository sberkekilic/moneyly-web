// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction } from '@/models/transaction';
import { FirestoreService } from '@/services/firestoreService';
import { useAuthStore } from './authStore';

const cleanForFirestore = (tx: Transaction): any => {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(tx)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned;
};

const getCutoffDates = (account: any) => {
  const now = new Date();
  const cutoffDay = account.cutoffDate || 1;
  
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), cutoffDay);
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, cutoffDay);
  
  // If today is before cutoff day this month, current period started last month
  const periodStart = now.getDate() >= cutoffDay ? currentMonth : previousMonth;
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  
  return { periodStart, periodEnd };
};

const updateAccountDebts = (account: any, amount: number, isAdding: boolean) => {
  if (account.isDebit !== false) return account;
  
  const multiplier = isAdding ? 1 : -1;
  const { periodStart, periodEnd } = getCutoffDates(account);
  
  const updated = { ...account };
  updated.totalDebt = Math.max((updated.totalDebt ?? 0) + amount * multiplier, 0);
  updated.currentDebt = Math.max((updated.currentDebt ?? 0) + amount * multiplier, 0);
  
  // Calculate available credit from limit minus debt
  const creditLimit = updated.creditLimit ?? 0;
  updated.availableCredit = Math.max(creditLimit - updated.totalDebt, 0);
  
  const txDate = new Date();
  if (txDate >= periodStart && txDate < periodEnd) {
    updated.remainingDebt = Math.max((updated.remainingDebt ?? 0) + amount * multiplier, 0);
  } else {
    updated.previousDebt = Math.max((updated.previousDebt ?? 0) + amount * multiplier, 0);
  }
  
  updated.minPayment = Math.max((updated.totalDebt ?? 0) * 0.3, 0);
  updated.remainingMinPayment = updated.minPayment;
  
  return updated;
};

interface TransactionState {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  bankDataList: any[];
  isLoading: boolean;
  error: string | null;

  loadAllData: () => Promise<void>;
  addTransaction: (transaction: Transaction, accountId: number, bankId: number) => Promise<void>;
  deleteTransaction: (accountId: number, bankId: number, transactionId: number, deleteAllInstallments?: boolean) => Promise<void>;
  updateTransaction: (transaction: Transaction, accountId: number, bankId: number, updateAllInstallments?: boolean) => Promise<void>;
  setBankDataList: (data: any[]) => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  filteredTransactions: [],
  bankDataList: [],
  isLoading: false,
  error: null,

  loadAllData: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ transactions: [], filteredTransactions: [], bankDataList: [], isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const data = await FirestoreService.loadAllData(user.uid);

      console.log('Loaded from Firebase:', data);
      
      // Load incomes into incomeStore
      if (data.incomes) {
        const { useIncomeStore } = await import('@/store/incomeStore');
        useIncomeStore.getState().setIncomes(data.incomes);
      }

      const recalculatedBanks = (data.bankData || []).map((bank: any) => ({
        ...bank,
        accounts: bank.accounts.map((acc: any) => {
          if (acc.isDebit !== false) return acc;
          
          const expenseTotal = (acc.transactions || [])
            .filter((t: any) => !t.isSurplus)
            .reduce((s: number, t: any) => s + t.amount, 0);

          const now = new Date();
          const cutoffDay = acc.cutoffDate || 1;
          let nextCutoff = new Date(now.getFullYear(), now.getMonth(), cutoffDay);
          if (now.getDate() >= cutoffDay) {
            nextCutoff.setMonth(nextCutoff.getMonth() + 1);
          }
          const nextDue = new Date(nextCutoff);
          nextDue.setDate(nextDue.getDate() + 10);
          
          return {
            ...acc,
            totalDebt: expenseTotal,
            currentDebt: expenseTotal,
            availableCredit: Math.max((acc.creditLimit ?? 0) - expenseTotal, 0),
            remainingDebt: expenseTotal,
            minPayment: Math.max(expenseTotal * 0.3, 0),
            remainingMinPayment: Math.max(expenseTotal * 0.3, 0),
            nextCutoffDate: nextCutoff.toISOString().split('T')[0],
            nextDueDate: nextDue.toISOString().split('T')[0],
          };
        }),
      }));
      
      set({
        bankDataList: recalculatedBanks,
        transactions: data.transactions || [],
        filteredTransactions: data.transactions || [],
        isLoading: false,
      });
    } catch (e) {
      console.error('Error loading data:', e);
      set({ error: 'Veriler yüklenemedi', isLoading: false });
    }
  },

  addTransaction: async (transaction, accountId, bankId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();
      const cleanedTx = cleanForFirestore(transaction);
      const isExpense = !cleanedTx.isSurplus;

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId === bankId) {
          return {
            ...bank,
            accounts: bank.accounts.map((acc: any) => {
              if (acc.accountId === accountId) {
                const updated = { ...acc, transactions: [...acc.transactions, cleanedTx] };
                
                // Update credit card debts
                if (!acc.isDebit && isExpense) {
  return updateAccountDebts(updated, cleanedTx.amount, true);
}
                
                return updated;
              }
              return acc;
            }),
          };
        }
        return bank;
      });

      const allTransactions = [...transactions, cleanedTx];
      await FirestoreService.saveAllData(user.uid, { bankData: updatedBanks, transactions: allTransactions });
      set({ bankDataList: updatedBanks, transactions: allTransactions, filteredTransactions: allTransactions, isLoading: false });
    } catch (e) {
      set({ error: 'İşlem eklenemedi', isLoading: false });
      throw e;
    }
  },

  deleteTransaction: async (accountId, bankId, transactionId, deleteAllInstallments = false) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();
      const txToDelete = transactions.find((t: Transaction) => t.transactionId === transactionId);
      if (!txToDelete) { set({ isLoading: false }); return; }

      let idsToDelete = new Set<number>([transactionId]);
      let totalDeleteAmount = txToDelete.amount;
      
      if (deleteAllInstallments) {
        if (txToDelete.parentTransactionId) {
          const siblings = transactions.filter((t: Transaction) => t.parentTransactionId === txToDelete.parentTransactionId);
          siblings.forEach(t => idsToDelete.add(t.transactionId));
          totalDeleteAmount = siblings.reduce((s, t) => s + t.amount, 0);
        } else if (txToDelete.initialInstallmentDate) {
          const baseTitle = txToDelete.title.includes(' (') ? txToDelete.title.split(' (')[0] : txToDelete.title;
          const related = transactions.filter((t: Transaction) => t.initialInstallmentDate === txToDelete.initialInstallmentDate && t.title.includes(baseTitle));
          related.forEach(t => idsToDelete.add(t.transactionId));
          totalDeleteAmount = related.reduce((s, t) => s + t.amount, 0);
        }
      }

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId === bankId) {
          return {
            ...bank,
            accounts: bank.accounts.map((acc: any) => {
              if (acc.accountId === accountId) {
                const updated = { 
                  ...acc, 
                  transactions: acc.transactions.filter((t: any) => !idsToDelete.has(t.transactionId)) 
                };
                
                // Reverse credit card debts when deleting expense
if (!acc.isDebit && !txToDelete.isSurplus) {
  return updateAccountDebts(updated, totalDeleteAmount, false);
}
                
                return updated;
              }
              return acc;
            }),
          };
        }
        return bank;
      });

      const updatedTransactions = transactions.filter((t: Transaction) => !idsToDelete.has(t.transactionId));

      await FirestoreService.saveAllData(user.uid, { bankData: updatedBanks, transactions: updatedTransactions });
      set({ bankDataList: updatedBanks, transactions: updatedTransactions, filteredTransactions: updatedTransactions, isLoading: false });
    } catch (e) {
      console.error('Error deleting transaction:', e);
      set({ error: 'İşlem silinemedi', isLoading: false });
      throw e;
    }
  },

  updateTransaction: async (transaction, accountId, bankId, updateAllInstallments = false) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });

    try {
      const { bankDataList, transactions } = get();
      const cleanedTx = cleanForFirestore(transaction);
      const oldTx = transactions.find((t: Transaction) => t.transactionId === transaction.transactionId);
      const amountDiff = cleanedTx.amount - (oldTx?.amount ?? 0);

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: bank.accounts.map((acc: any) => {
            if (acc.accountId !== accountId) return acc;

            // Update transaction(s) in list
            let updatedTxList = [...(acc.transactions || [])];

            if (updateAllInstallments && cleanedTx.parentTransactionId) {
              updatedTxList = updatedTxList.map((t: any) => {
                if (t.parentTransactionId === cleanedTx.parentTransactionId) {
                  return {
                    ...t,
                    title: cleanedTx.title,
                    category: cleanedTx.category,
                    subcategory: cleanedTx.subcategory,
                    description: cleanedTx.description,
                    currency: cleanedTx.currency,
                    isProvisioned: cleanedTx.isProvisioned,
                  };
                }
                return t;
              });
            } else {
              updatedTxList = updatedTxList.map((t: any) =>
                t.transactionId === cleanedTx.transactionId ? cleanedTx : t
              );
            }

            const updated = { ...acc, transactions: updatedTxList };

            // ── FIX: Recalculate ALL debts from scratch for credit cards ──
            if (acc.isDebit === false) {
              const expenseTotal = updatedTxList
                .filter((t: any) => !t.isSurplus)
                .reduce((s: number, t: any) => s + (t.amount ?? 0), 0);

              const creditLimit = acc.creditLimit ?? 0;

              const now = new Date();
              const cutoffDay = acc.cutoffDate || 1;
              let nextCutoff = new Date(now.getFullYear(), now.getMonth(), cutoffDay);
              if (now.getDate() >= cutoffDay) {
                nextCutoff.setMonth(nextCutoff.getMonth() + 1);
              }
              const nextDue = new Date(nextCutoff);
              nextDue.setDate(nextDue.getDate() + 10);

              return {
                ...updated,
                totalDebt: expenseTotal,
                currentDebt: expenseTotal,
                remainingDebt: expenseTotal,
                availableCredit: Math.max(creditLimit - expenseTotal, 0),
                minPayment: Math.max(expenseTotal * 0.3, 0),
                remainingMinPayment: Math.max(expenseTotal * 0.3, 0),
                nextCutoffDate: nextCutoff.toISOString().split('T')[0],
                nextDueDate: nextDue.toISOString().split('T')[0],
              };
            }

            return updated;
          }),
        };
      });

      // Update global transactions list
      const updatedTransactions = updateAllInstallments && cleanedTx.parentTransactionId
        ? transactions.map((t: Transaction) => {
            if (t.parentTransactionId === cleanedTx.parentTransactionId) {
              return {
                ...t,
                title: cleanedTx.title,
                category: cleanedTx.category,
                subcategory: cleanedTx.subcategory,
                description: cleanedTx.description,
                currency: cleanedTx.currency,
                isProvisioned: cleanedTx.isProvisioned,
              };
            }
            return t;
          })
        : transactions.map((t: Transaction) =>
            t.transactionId === transaction.transactionId ? cleanedTx : t
          );

      await FirestoreService.saveAllData(user.uid, {
        bankData: updatedBanks,
        transactions: updatedTransactions,
      });

      set({
        bankDataList: updatedBanks,
        transactions: updatedTransactions,
        filteredTransactions: updatedTransactions,
        isLoading: false,
      });
    } catch (e) {
      console.error('Error updating transaction:', e);
      set({ error: 'İşlem güncellenemedi', isLoading: false });
      throw e;
    }
  },

  setBankDataList: (data) => set({ bankDataList: data }),
}));