// src/store/transactionStore.ts
import { create } from 'zustand';
import { Transaction, createTransaction, TransactionType } from '@/models/transaction';
import { FirestoreService } from '@/services/firestoreService';
import { useAuthStore } from './authStore';
import { recalculateCreditAccount, toLocalISOString, parseLocalDateInput } from '@/lib/creditCard';

const cleanForFirestore = (tx: Transaction): any => {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(tx)) {
    if (value !== undefined) cleaned[key] = value;
  }
  return cleaned;
};

interface TransactionState {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  bankDataList: any[];
  isLoading: boolean;
  error: string | null;

  loadAllData: () => Promise<void>;
  addTransaction: (
    transaction: Transaction,
    accountId: number,
    bankId: number
  ) => Promise<void>;
  deleteTransaction: (
    accountId: number,
    bankId: number,
    transactionId: number,
    deleteAllInstallments?: boolean
  ) => Promise<void>;
  updateTransaction: (
    transaction: Transaction,
    accountId: number,
    bankId: number,
    updateAllInstallments?: boolean
  ) => Promise<void>;
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

  loadAllData: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({
        transactions: [],
        filteredTransactions: [],
        bankDataList: [],
        isLoading: false,
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await FirestoreService.loadAllData(user.uid);

      if (data.incomes) {
        const { useIncomeStore } = await import('@/store/incomeStore');
        useIncomeStore.getState().setIncomes(data.incomes);
      }

      const recalculatedBanks = (data.bankData || []).map((bank: any) => ({
        ...bank,
        accounts: (bank.accounts || []).map((acc: any) =>
          acc.isDebit === false
            ? recalculateCreditAccount({
                ...acc,
                debtPayments: acc.debtPayments || [],
              })
            : acc
        ),
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

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;

        return {
          ...bank,
          accounts: (bank.accounts || []).map((acc: any) => {
            if (acc.accountId !== accountId) return acc;

            const updated = {
              ...acc,
              transactions: [...(acc.transactions || []), cleanedTx],
            };

            return acc.isDebit === false
              ? recalculateCreditAccount(updated)
              : updated;
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

  deleteTransaction: async (
    accountId,
    bankId,
    transactionId,
    deleteAllInstallments = false
  ) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ isLoading: true, error: null });

    try {
      const { bankDataList, transactions } = get();
      const txToDelete = transactions.find(
        (t: Transaction) => t.transactionId === transactionId
      );
      if (!txToDelete) {
        set({ isLoading: false });
        return;
      }

      const idsToDelete = new Set<number>([transactionId]);

      if (deleteAllInstallments) {
        if (txToDelete.parentTransactionId) {
          transactions
            .filter(
              (t: Transaction) =>
                t.parentTransactionId === txToDelete.parentTransactionId
            )
            .forEach((t) => idsToDelete.add(t.transactionId));
        } else if (txToDelete.initialInstallmentDate) {
          transactions
            .filter(
              (t: Transaction) =>
                t.initialInstallmentDate ===
                  txToDelete.initialInstallmentDate &&
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
              transactions: (acc.transactions || []).filter(
                (t: any) => !idsToDelete.has(t.transactionId)
              ),
            };

            return acc.isDebit === false
              ? recalculateCreditAccount(updated)
              : updated;
          }),
        };
      });

      const updatedTransactions = transactions.filter(
        (t: Transaction) => !idsToDelete.has(t.transactionId)
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
      console.error('Error deleting transaction:', e);
      set({ error: 'İşlem silinemedi', isLoading: false });
      throw e;
    }
  },

  updateTransaction: async (
    transaction,
    accountId,
    bankId,
    updateAllInstallments = false
  ) => {
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

            let updatedTxList = [...(acc.transactions || [])];

            if (updateAllInstallments && cleanedTx.parentTransactionId) {
              updatedTxList = updatedTxList.map((t: any) => {
                if (
                  t.parentTransactionId === cleanedTx.parentTransactionId
                ) {
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

            return acc.isDebit === false
              ? recalculateCreditAccount(updated)
              : updated;
          }),
        };
      });

      const updatedTransactions =
        updateAllInstallments && cleanedTx.parentTransactionId
          ? transactions.map((t: Transaction) => {
              if (
                t.parentTransactionId === cleanedTx.parentTransactionId
              ) {
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

  /**
   * Pay credit card debt:
   * 1. Records a debtPayment entry on the account
   * 2. Creates a surplus (income-type) transaction so it shows in outcome page
   * 3. Recalculates all debt figures
   */
  payCreditCardDebt: async (accountId, bankId, amount, paidAt, note) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    if (!amount || amount <= 0) return;

    set({ isLoading: true, error: null });

    try {
      const { bankDataList, transactions } = get();

      // Find account info for the payment transaction
      let accountName = '';
      let bankName = '';
      let currency = 'TRY';

      for (const bank of bankDataList) {
        if (bank.bankId === bankId) {
          bankName = bank.bankName;
          const acc = (bank.accounts || []).find(
            (a: any) => a.accountId === accountId
          );
          if (acc) {
            accountName = acc.name;
            currency = acc.currency || 'TRY';
          }
        }
      }

      const paymentDate = paidAt
        ? toLocalISOString(parseLocalDateInput(paidAt))
        : toLocalISOString(new Date());

      // Create a surplus transaction that represents the payment
      const paymentTx = createTransaction({
        title: `${bankName} ${accountName} Borç Ödemesi`,
        amount,
        category: 'Borç Ödemesi',
        subcategory: accountName,
        date: paymentDate,
        currency,
        isSurplus: true,
        description: note?.trim() || `Kredi kartı borç ödemesi`,
        isFromInvoice: false,
        isProvisioned: false,
        transactionType: TransactionType.normal,
      });

      const cleanedPaymentTx = cleanForFirestore(paymentTx);

      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: (bank.accounts || []).map((acc: any) => {
            if (acc.accountId !== accountId) return acc;
            if (acc.isDebit !== false) return acc;

            const safeAmount = Math.min(amount, acc.totalDebt ?? amount);

            const updated = {
              ...acc,
              debtPayments: [
                ...(acc.debtPayments || []),
                {
                  paymentId: Date.now(),
                  amount: safeAmount,
                  date: paymentDate,
                  note: note?.trim() || '',
                  transactionId: paymentTx.transactionId,
                },
              ],
              // Also add the surplus tx to the account's transactions
              transactions: [
                ...(acc.transactions || []),
                cleanedPaymentTx,
              ],
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

  /**
   * Pay a single installment transaction:
   * marks it as paid and records a debt payment
   */
  payInstallment: async (accountId, bankId, transactionId, amount, paidAt) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ isLoading: true, error: null });

    try {
      const { bankDataList, transactions } = get();

      const targetTx = transactions.find(
        (t) => t.transactionId === transactionId
      );
      if (!targetTx) {
        set({ isLoading: false });
        return;
      }

      // Find account info
      let accountName = '';
      let bankName = '';
      let currency = targetTx.currency || 'TRY';

      for (const bank of bankDataList) {
        if (bank.bankId === bankId) {
          bankName = bank.bankName;
          const acc = (bank.accounts || []).find(
            (a: any) => a.accountId === accountId
          );
          if (acc) {
            accountName = acc.name;
          }
        }
      }

      const paymentDate = paidAt
        ? toLocalISOString(parseLocalDateInput(paidAt))
        : toLocalISOString(new Date());

      const paymentAmount = amount || targetTx.amount;

      // Create payment transaction (surplus)
      const paymentTx = createTransaction({
        title: `${targetTx.title} - Taksit Ödemesi`,
        amount: paymentAmount,
        category: 'Borç Ödemesi',
        subcategory: targetTx.category || accountName,
        date: paymentDate,
        currency,
        isSurplus: true,
        description: `${targetTx.currentInstallment || '?'}/${targetTx.installment || '?'} taksit ödemesi`,
        isFromInvoice: false,
        isProvisioned: false,
        transactionType: TransactionType.normal,
      });

      const cleanedPaymentTx = cleanForFirestore(paymentTx);

      // Update the original transaction as paid
      const updatedBanks = bankDataList.map((bank: any) => {
        if (bank.bankId !== bankId) return bank;
        return {
          ...bank,
          accounts: (bank.accounts || []).map((acc: any) => {
            if (acc.accountId !== accountId) return acc;

            // Mark the installment as paid in account transactions
            const updatedTxList = (acc.transactions || []).map((t: any) => {
              if (t.transactionId === transactionId) {
                return {
                  ...t,
                  isInstallmentPaid: true,
                  paidAmount: paymentAmount,
                };
              }
              return t;
            });

            const updated = {
              ...acc,
              transactions: [...updatedTxList, cleanedPaymentTx],
              debtPayments: [
                ...(acc.debtPayments || []),
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

            return acc.isDebit === false
              ? recalculateCreditAccount(updated)
              : updated;
          }),
        };
      });

      // Update global transactions list
      const updatedTransactions = transactions.map((t: Transaction) => {
        if (t.transactionId === transactionId) {
          return {
            ...t,
            isInstallmentPaid: true,
            paidAmount: paymentAmount,
          };
        }
        return t;
      });

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