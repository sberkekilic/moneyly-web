// src/services/firestoreService.ts
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction } from '@/models/transaction';
import { BankData } from '@/models/account';

// Helper function to remove undefined values from objects
function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

export const FirestoreService = {
  // ── Check if Firestore is available ──────────────
  isAvailable: (): boolean => {
    try {
      return !!db;
    } catch {
      return false;
    }
  },

  // ── Transactions ────────────────────────────────
  async saveTransactions(userId: string, transactions: Transaction[]) {
    if (!FirestoreService.isAvailable()) {
      console.warn('Firestore not available, skipping save');
      return;
    }
    
    try {
      const cleanedTransactions = removeUndefined(transactions);
      const ref = doc(db, 'userData', userId);
      await setDoc(ref, { 
        transactions: cleanedTransactions,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log('Transactions saved to Firestore');
    } catch (error) {
      console.error('Error saving transactions to Firestore:', error);
      // Don't throw - allow app to continue working with localStorage
    }
  },

  async loadTransactions(userId: string): Promise<Transaction[]> {
    if (!FirestoreService.isAvailable()) {
      console.warn('Firestore not available, returning empty array');
      return [];
    }
    
    try {
      const ref = doc(db, 'userData', userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        console.log('Transactions loaded from Firestore:', data.transactions?.length || 0);
        return data.transactions || [];
      }
      return [];
    } catch (error) {
      console.error('Error loading transactions from Firestore:', error);
      return []; // Return empty array instead of throwing
    }
  },

  // ── Bank Data ───────────────────────────────────
  async saveBankData(userId: string, bankData: BankData[]) {
    if (!FirestoreService.isAvailable()) {
      console.warn('Firestore not available, skipping bank data save');
      return;
    }
    
    try {
      const cleanedBankData = removeUndefined(bankData);
      const ref = doc(db, 'userData', userId);
      await setDoc(ref, { 
        bankData: cleanedBankData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log('Bank data saved to Firestore');
    } catch (error) {
      console.error('Error saving bank data to Firestore:', error);
      // Don't throw - allow app to continue working with localStorage
    }
  },

  async loadBankData(userId: string): Promise<BankData[]> {
    if (!FirestoreService.isAvailable()) {
      console.warn('Firestore not available, returning empty array');
      return [];
    }
    
    try {
      const ref = doc(db, 'userData', userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        console.log('Bank data loaded from Firestore');
        return data.bankData || [];
      }
      return [];
    } catch (error) {
      console.error('Error loading bank data from Firestore:', error);
      return []; // Return empty array instead of throwing
    }
  },

  // ── All User Data ───────────────────────────────
async loadAllData(userId: string) {
    if (!FirestoreService.isAvailable()) {
      return { transactions: [], bankData: [], incomes: [], investments: [], investmentModels: [] };
    }
    try {
      const ref = doc(db, 'userData', userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data();
      }
      return { 
        transactions: [], 
        bankData: [],
        incomes: [],
        investments: [],
        investmentModels: [],
      };
    } catch (error) {
      console.error('Error loading all data:', error);
      return { transactions: [], bankData: [], incomes: [], investments: [], investmentModels: [] };
    }
  },

  async saveAllData(userId: string, data: any) {
    if (!FirestoreService.isAvailable()) {
      console.warn('Firestore not available, skipping save');
      return;
    }
    
    try {
      const cleanedData = removeUndefined(data);
      const ref = doc(db, 'userData', userId);
      await setDoc(ref, { 
        ...cleanedData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving all data to Firestore:', error);
      // Don't throw
    }
  },

  async saveIncomes(userId: string, incomes: any[]) {
  if (!FirestoreService.isAvailable()) return;
  try {
    const cleaned = removeUndefined(incomes);
    const ref = doc(db, 'userData', userId);
    await setDoc(ref, { incomes: cleaned, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) { console.error('Error saving incomes:', error); }
},

async loadIncomes(userId: string): Promise<any[]> {
  if (!FirestoreService.isAvailable()) return [];
  try {
    const ref = doc(db, 'userData', userId);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().incomes || [];
    return [];
  } catch (error) { console.error('Error loading incomes:', error); return []; }
},

};