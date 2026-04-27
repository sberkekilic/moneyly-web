// src/store/incomeStore.ts
import { create } from 'zustand';
import { Income } from '@/models/income';
import { FirestoreService } from '@/services/firestoreService';
import { useAuthStore } from './authStore';

interface IncomeState {
  incomes: Income[];
  isLoading: boolean;
  error: string | null;
  
  setIncomes: (incomes: Income[]) => void;
  loadIncomes: () => Promise<void>;
  addIncome: (income: Income) => Promise<void>;
  deleteIncome: (id: number) => Promise<void>;
  updateIncome: (income: Income) => Promise<void>;
  getTotalIncome: () => number;
}

export const useIncomeStore = create<IncomeState>((set, get) => ({
  incomes: [],
  isLoading: false,
  error: null,

  setIncomes: (incomes) => set({ incomes }),

  loadIncomes: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true });
    try {
      const incomes = await FirestoreService.loadIncomes(user.uid);
      set({ incomes, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  addIncome: async (income) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true });
    try {
      const updated = [...get().incomes, income];
      await FirestoreService.saveIncomes(user.uid, updated);
      set({ incomes: updated, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  deleteIncome: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true });
    try {
      const updated = get().incomes.filter(i => i.incomeId !== id);
      await FirestoreService.saveIncomes(user.uid, updated);
      set({ incomes: updated, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  updateIncome: async (income: Income) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const { incomes } = get();
    const updated = incomes.map(i => i.incomeId === income.incomeId ? income : i);
    set({ incomes: updated });

    await FirestoreService.saveAllData(user.uid, {
      ...(await FirestoreService.loadAllData(user.uid)),
      incomes: updated,
    });
  },

  getTotalIncome: () => get().incomes.reduce((sum, i) => sum + i.amount, 0),
}));