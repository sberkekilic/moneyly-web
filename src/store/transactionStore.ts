// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction, createTransaction, TransactionType } from '@/models/transaction';
import { FirestoreService } from '@/services/firestoreService';
import { useAuthStore } from './authStore';
import {
  recalculateCreditAccount,
  toLocalISOString,
  parseLocalDateInput,
} from '@/lib/creditCard';

const cleanForFirestore = (tx: Transaction): any => {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(tx)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned;
};

function getTxIdsForAccount(bank: any, accountId: number): Set<number> {
  const ids = new Set<number>();
  const acc = (bank.accounts ?? []).find((a: any) => a.accountId === accountId);
  if (acc) {
    (acc.transactions ?? []).forEach((t: any) => ids.add(t.transactionId));
  }
  return ids;
}

interface TransactionState {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  bankDataList: any[];
  isLoading: boolean;
  error: string | null;

  loadAllData: () => Promise<void>;
  addTransaction: (tx: Transaction, accountId: number, bankId: number) => Promise<void>;
  deleteTransaction: (
    accountId: number,
    bankId: number,
    transactionId: number,
    deleteAllInstallments?: boolean
  ) => Promise<void>;
  updateTransaction: (
    tx: Transaction,
    accountId: number,
    bankId: number,
    updateAllInstallments?: boolean
  ) => Promise<void>;
  deleteAccount: (accountId: number, bankId: number) => Promise<void>;
  deleteAllUserData: () => Promise<void>;
  payCreditCardDebt: (
    accountId: number,
    bankId: number,
    amount: number,
    paidAt?: string,
    note?: string
  ) => Promise<void>;
  payInstallment: (
    accountId: number,
    bankId: number,
    transactionId: number,
    amount: number,
    paidAt?: string
  ) => Promise<void>;
  setBankDataList: (data: any[]) => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  filteredTransactions: [],
  bankDataList: [],
  isLoading: false,
  error: null,

  // ── Load ──────────────────────────────────────────────────────────────
  loadAllData: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ transactions: [], filteredTransactions: [], bankDataList: [], isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const data = await FirestoreService.loadAllData(user.uid);

      if (data.incomes) {
        const { useIncomeStore } = await import('@/store/incomeStore');
        useIncomeStore.getState().setIncomes(data.incomes);
      }

      if (data.investments !== undefined || data.investmentModels !== undefined) {
        const { useInvestmentStore } = await import('@/store/investmentStore');
        const invStore = useInvestmentStore.getState();
        if (data.investments) invStore.setInvestments(data.investments);
        if (data.investmentModels) invStore.setInvestmentModels(data.investmentModels);
      }

      const recalculatedBanks = (data.bankData || []).map((bank: any) => ({
        ...bank,
        accounts: (bank.accounts || []).map((acc: any) =>
          acc.isDebit === false
            ? recalculateCreditAccount({ ...acc, debtPayments: acc.debtPayments || [] })
            : acc
        ),
      }));

      const txsFromBanks: Transaction[] = recalculatedBanks.flatMap((bank: any) =>
        (bank.accounts ?? []).flatMap((acc: any) =>
          (acc.transactions ?? []).map((t: any) => t as Transaction)
        )
      );

      const txIdsInBanks = new Set(txsFromBanks.map((t) => t.transactionId));
      const standaloneFirestoreTxs = (data.transactions ?? []).filter(
        (t: any) => !txIdsInBanks.has(t.transactionId)
      );

      const allTransactions = [...txsFromBanks, ...standaloneFirestoreTxs];

      set({
        bankDataList: recalculatedBanks,
        transactions: allTransactions,
        filteredTransactions: allTransactions,
        isLoading: false,
      });
    } catch (e) {
      console.error('Error loading data:', e);
      set({ error: 'Veriler yüklenemedi', isLoading: false });
    }
  },

  // ── Add Transaction ───────────────────────────────────────────────────
  addTransaction: async (transaction, accountId, bankId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();
      const cleanedTx = cleanForFirestore(transaction);

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: (bank.accounts || []).map((acc: any) => {
            if (acc.accountId !== accountId) return acc;
            const updated = {
              ...acc,
              transactions: [...(acc.transactions ?? []), cleanedTx],
            };
            return acc.isDebit === false ? recalculateCreditAccount(updated) : updated;
          }),
        };
      });

      const allTransactions = [...transactions, cleanedTx];

      await FirestoreService.saveAllData(user.uid, {
        bankData: updatedBanks,
        transactions: allTransactions,
      });

      set({
        bankDataList: updatedBanks,
        transactions: allTransactions,
        filteredTransactions: allTransactions,
        isLoading: false,
      });
    } catch (e) {
      console.error('Error adding transaction:', e);
      set({ error: 'İşlem eklenemedi', isLoading: false });
      throw e;
    }
  },

  // ── Delete Transaction ────────────────────────────────────────────────
  deleteTransaction: async (accountId, bankId, transactionId, deleteAllInstallments = false) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();
      const txToDelete = transactions.find((t) => t.transactionId === transactionId);
      if (!txToDelete) { set({ isLoading: false }); return; }

      const idsToDelete = new Set<number>([transactionId]);

      if (deleteAllInstallments) {
        if (txToDelete.parentTransactionId) {
          transactions
            .filter((t) => t.parentTransactionId === txToDelete.parentTransactionId)
            .forEach((t) => idsToDelete.add(t.transactionId));
        } else if (txToDelete.initialInstallmentDate) {
          transactions
            .filter(
              (t) =>
                t.initialInstallmentDate === txToDelete.initialInstallmentDate &&
                t.title === txToDelete.title
            )
            .forEach((t) => idsToDelete.add(t.transactionId));
        }
      }

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: (bank.accounts || []).map((acc: any) => {
            if (acc.accountId !== accountId) return acc;
            const updated = {
              ...acc,
              transactions: (acc.transactions ?? []).filter(
                (t: any) => !idsToDelete.has(t.transactionId)
              ),
            };
            return acc.isDebit === false ? recalculateCreditAccount(updated) : updated;
          }),
        };
      });

      const updatedTransactions = transactions.filter((t) => !idsToDelete.has(t.transactionId));

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
      console.error('Error deleting transaction:', e);
      set({ error: 'İşlem silinemedi', isLoading: false });
      throw e;
    }
  },

  // ── Update Transaction ────────────────────────────────────────────────
  updateTransaction: async (transaction, accountId, bankId, updateAllInstallments = false) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();
      const cleanedTx = cleanForFirestore(transaction);

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: (bank.accounts || []).map((acc: any) => {
            if (acc.accountId !== accountId) return acc;

            let updatedTxList = [...(acc.transactions ?? [])];
            if (updateAllInstallments && cleanedTx.parentTransactionId) {
              updatedTxList = updatedTxList.map((t: any) =>
                t.parentTransactionId === cleanedTx.parentTransactionId
                  ? {
                      ...t,
                      title: cleanedTx.title,
                      category: cleanedTx.category,
                      subcategory: cleanedTx.subcategory,
                      description: cleanedTx.description,
                      currency: cleanedTx.currency,
                      isProvisioned: cleanedTx.isProvisioned,
                    }
                  : t
              );
            } else {
              updatedTxList = updatedTxList.map((t: any) =>
                t.transactionId === cleanedTx.transactionId ? cleanedTx : t
              );
            }

            const updated = { ...acc, transactions: updatedTxList };
            return acc.isDebit === false ? recalculateCreditAccount(updated) : updated;
          }),
        };
      });

      const updatedTransactions =
        updateAllInstallments && cleanedTx.parentTransactionId
          ? transactions.map((t) =>
              t.parentTransactionId === cleanedTx.parentTransactionId
                ? {
                    ...t,
                    title: cleanedTx.title,
                    category: cleanedTx.category,
                    subcategory: cleanedTx.subcategory,
                    description: cleanedTx.description,
                    currency: cleanedTx.currency,
                    isProvisioned: cleanedTx.isProvisioned,
                  }
                : t
            )
          : transactions.map((t) =>
              t.transactionId === cleanedTx.transactionId ? cleanedTx : t
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

  // ── Delete Account ────────────────────────────────────────────────────
  deleteAccount: async (accountId, bankId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();

      const idsToRemove = new Set<number>();
      for (const bank of bankDataList) {
        if (bank.bankId === bankId) {
          getTxIdsForAccount(bank, accountId).forEach((id) => idsToRemove.add(id));
        }
      }

      const updatedBanks = bankDataList
        .map((bank: any) => {
          if (bank.bankId !== bankId) return bank;
          return {
            ...bank,
            accounts: (bank.accounts ?? []).filter((a: any) => a.accountId !== accountId),
          };
        })
        .filter((bank: any) => (bank.accounts ?? []).length > 0);

      const updatedTransactions = transactions.filter((t) => !idsToRemove.has(t.transactionId));

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
      console.error('Error deleting account:', e);
      set({ error: 'Hesap silinemedi', isLoading: false });
      throw e;
    }
  },

  // ── Delete ALL user data ──────────────────────────────────────────────
  // Delegates entirely to FirestoreService — no raw Firestore calls needed here
  deleteAllUserData: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const emptyData = {
        bankData: [],
        transactions: [],
        incomes: [],
        investments: [],
        investmentModels: [],
      };

      // FirestoreService.saveAllData does load-then-overwrite (no merge)
      await FirestoreService.saveAllData(user.uid, emptyData);

      // Clear all stores
      const { useIncomeStore } = await import('@/store/incomeStore');
      useIncomeStore.getState().setIncomes([]);

      const { useInvestmentStore } = await import('@/store/investmentStore');
      useInvestmentStore.getState().setInvestments([]);
      useInvestmentStore.getState().setInvestmentModels([]);

      set({
        bankDataList: [],
        transactions: [],
        filteredTransactions: [],
        isLoading: false,
      });
    } catch (e) {
      console.error('Error deleting all data:', e);
      set({ error: 'Veriler silinemedi', isLoading: false });
      throw e;
    }
  },

  // ── Pay Credit Card Debt ──────────────────────────────────────────────
  payCreditCardDebt: async (accountId, bankId, amount, paidAt, note) => {
    const user = useAuthStore.getState().user;
    if (!user || !amount || amount <= 0) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();

      let accountName = '';
      let bankName = '';
      let currency = 'TRY';

      for (const bank of bankDataList) {
        if (bank.bankId === bankId) {
          bankName = bank.bankName;
          const acc = (bank.accounts ?? []).find((a: any) => a.accountId === accountId);
          if (acc) { accountName = acc.name; currency = acc.currency || 'TRY'; }
        }
      }

      const paymentDate = paidAt
        ? toLocalISOString(parseLocalDateInput(paidAt))
        : toLocalISOString(new Date());

      const paymentTx = createTransaction({
        title: `${bankName} ${accountName} Borç Ödemesi`,
        amount,
        category: 'Borç Ödemesi',
        subcategory: accountName,
        date: paymentDate,
        currency,
        isSurplus: true,
        description: note?.trim() || 'Kredi kartı borç ödemesi',
        isFromInvoice: false,
        isProvisioned: false,
        transactionType: TransactionType.normal,
      });

      const cleanedPaymentTx = cleanForFirestore(paymentTx);

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: (bank.accounts ?? []).map((acc: any) => {
            if (acc.accountId !== accountId || acc.isDebit !== false) return acc;
            const safeAmount = Math.min(amount, acc.totalDebt ?? amount);
            const updated = {
              ...acc,
              debtPayments: [
                ...(acc.debtPayments ?? []),
                {
                  paymentId: Date.now(),
                  amount: safeAmount,
                  date: paymentDate,
                  note: note?.trim() || '',
                  transactionId: paymentTx.transactionId,
                },
              ],
              transactions: [...(acc.transactions ?? []), cleanedPaymentTx],
            };
            return recalculateCreditAccount(updated);
          }),
        };
      });

      const allTransactions = [...transactions, cleanedPaymentTx];

      await FirestoreService.saveAllData(user.uid, {
        bankData: updatedBanks,
        transactions: allTransactions,
      });

      set({
        bankDataList: updatedBanks,
        transactions: allTransactions,
        filteredTransactions: allTransactions,
        isLoading: false,
      });
    } catch (e) {
      console.error('Error paying debt:', e);
      set({ error: 'Borç ödemesi kaydedilemedi', isLoading: false });
      throw e;
    }
  },

  // ── Pay Single Installment ────────────────────────────────────────────
  payInstallment: async (accountId, bankId, transactionId, amount, paidAt) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true, error: null });
    try {
      const { bankDataList, transactions } = get();
      const targetTx = transactions.find((t) => t.transactionId === transactionId);
      if (!targetTx) { set({ isLoading: false }); return; }

      let accountName = '';
      let bankName = '';
      const currency = targetTx.currency || 'TRY';

      for (const bank of bankDataList) {
        if (bank.bankId === bankId) {
          bankName = bank.bankName;
          const acc = (bank.accounts ?? []).find((a: any) => a.accountId === accountId);
          if (acc) accountName = acc.name;
        }
      }

      const paymentDate = paidAt
        ? toLocalISOString(parseLocalDateInput(paidAt))
        : toLocalISOString(new Date());

      const paymentAmount = amount || targetTx.amount;

      const paymentTx = createTransaction({
        title: `${targetTx.title} - Taksit Ödemesi`,
        amount: paymentAmount,
        category: 'Borç Ödemesi',
        subcategory: targetTx.category || accountName,
        date: paymentDate,
        currency,
        isSurplus: true,
        description: `${targetTx.currentInstallment ?? '?'}/${targetTx.installment ?? '?'} taksit ödemesi`,
        isFromInvoice: false,
        isProvisioned: false,
        transactionType: TransactionType.normal,
      });

      const cleanedPaymentTx = cleanForFirestore(paymentTx);

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: (bank.accounts ?? []).map((acc: any) => {
            if (acc.accountId !== accountId) return acc;

            const updatedTxList = (acc.transactions ?? []).map((t: any) =>
              t.transactionId === transactionId
                ? { ...t, isInstallmentPaid: true, paidAmount: paymentAmount }
                : t
            );

            const updated = {
              ...acc,
              transactions: [...updatedTxList, cleanedPaymentTx],
              debtPayments: [
                ...(acc.debtPayments ?? []),
                {
                  paymentId: Date.now(),
                  amount: paymentAmount,
                  date: paymentDate,
                  note: `${targetTx.title} taksit ödemesi`,
                  transactionId: paymentTx.transactionId,
                  paidTransactionId: transactionId,
                },
              ],
            };

            return acc.isDebit === false ? recalculateCreditAccount(updated) : updated;
          }),
        };
      });

      const updatedTransactions = transactions.map((t) =>
        t.transactionId === transactionId
          ? { ...t, isInstallmentPaid: true, paidAmount: paymentAmount }
          : t
      );

      const allTransactions = [...updatedTransactions, cleanedPaymentTx];

      await FirestoreService.saveAllData(user.uid, {
        bankData: updatedBanks,
        transactions: allTransactions,
      });

      set({
        bankDataList: updatedBanks,
        transactions: allTransactions,
        filteredTransactions: allTransactions,
        isLoading: false,
      });
    } catch (e) {
      console.error('Error paying installment:', e);
      set({ error: 'Taksit ödemesi kaydedilemedi', isLoading: false });
      throw e;
    }
  },

  setBankDataList: (data) => set({ bankDataList: data }),
}));