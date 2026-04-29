// src/store/incomeStore.ts
import { create } from 'zustand';
import { Income } from '@/models/income';
import { FirestoreService } from '@/services/firestoreService';
import { useAuthStore } from './authStore';

interface IncomeState {
  incomes: Income[];
  isLoading: boolean;

  loadIncomes: () => Promise<void>;
  addIncome: (income: Income) => Promise<void>;
  deleteIncome: (incomeId: number) => Promise<void>;
  updateIncome: (income: Income) => Promise<void>;
  setIncomes: (incomes: Income[]) => void;
  getTotalIncome: () => number;
}

export const useIncomeStore = create<IncomeState>((set, get) => ({
  incomes: [],
  isLoading: false,

  setIncomes: (incomes) => set({ incomes }),

  loadIncomes: async () => {
    const user = useAuthStore.getState().user;
    if (!user) { set({ incomes: [] }); return; }
    set({ isLoading: true });
    try {
      const data = await FirestoreService.loadAllData(user.uid);
      set({ incomes: data.incomes ?? [], isLoading: false });
    } catch (e) {
      console.error('Error loading incomes:', e);
      set({ isLoading: false });
    }
  },

  addIncome: async (income) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { incomes } = get();
    const updated = [...incomes, income];
    set({ incomes: updated });
    await FirestoreService.saveAllData(user.uid, { incomes: updated });
  },

  deleteIncome: async (incomeId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { incomes } = get();
    const updated = incomes.filter((i) => i.incomeId !== incomeId);
    set({ incomes: updated });
    await FirestoreService.saveAllData(user.uid, { incomes: updated });
  },

  updateIncome: async (income) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { incomes } = get();
    const updated = incomes.map((i) =>
      i.incomeId === income.incomeId ? income : i
    );
    set({ incomes: updated });
    await FirestoreService.saveAllData(user.uid, { incomes: updated });
  },

  getTotalIncome: () => {
    return get().incomes.reduce((sum, i) => sum + i.amount, 0);
  },
}));