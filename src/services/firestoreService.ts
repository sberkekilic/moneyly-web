// src/services/firestoreService.ts
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction } from '@/models/transaction';
import { BankData } from '@/models/account';

function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) cleaned[key] = removeUndefined(value);
    }
    return cleaned;
  }
  return obj;
}

export const FirestoreService = {
  isAvailable: (): boolean => {
    try { return !!db; } catch { return false; }
  },

  async saveAllData(userId: string, data: Partial<{
    bankData: any[];
    transactions: any[];
    incomes: any[];
    investments: any[];
    investmentModels: any[];
  }>) {
    if (!FirestoreService.isAvailable()) return;
    try {
      // First load the current full document so we don't wipe other fields
      const current = await FirestoreService.loadAllData(userId);
      const merged = {
        ...current,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const cleaned = removeUndefined(merged);
      const ref = doc(db, 'userData', userId);
      // setDoc WITHOUT merge — overwrites the full document
      await setDoc(ref, cleaned);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  },

  async loadAllData(userId: string) {
    if (!FirestoreService.isAvailable()) {
      return {
        transactions: [],
        bankData: [],
        incomes: [],
        investments: [],
        investmentModels: [],
      };
    }
    try {
      const ref = doc(db, 'userData', userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        return {
          transactions:    data.transactions    ?? [],
          bankData:        data.bankData        ?? [],
          incomes:         data.incomes         ?? [],
          investments:     data.investments     ?? [],
          investmentModels:data.investmentModels?? [],
        };
      }
      return {
        transactions: [], bankData: [], incomes: [],
        investments: [], investmentModels: [],
      };
    } catch (error) {
      console.error('Error loading data:', error);
      return {
        transactions: [], bankData: [], incomes: [],
        investments: [], investmentModels: [],
      };
    }
  },

  // ── Legacy helpers (kept for backward compat, delegate to saveAllData) ──
  async saveTransactions(userId: string, transactions: Transaction[]) {
    await FirestoreService.saveAllData(userId, { transactions });
  },

  async loadTransactions(userId: string): Promise<Transaction[]> {
    return (await FirestoreService.loadAllData(userId)).transactions ?? [];
  },

  async saveBankData(userId: string, bankData: BankData[]) {
    await FirestoreService.saveAllData(userId, { bankData });
  },

  async loadBankData(userId: string): Promise<BankData[]> {
    return (await FirestoreService.loadAllData(userId)).bankData ?? [];
  },

  async saveIncomes(userId: string, incomes: any[]) {
    await FirestoreService.saveAllData(userId, { incomes });
  },

  async loadIncomes(userId: string): Promise<any[]> {
    return (await FirestoreService.loadAllData(userId)).incomes ?? [];
  },
};