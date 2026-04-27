// src/store/investmentStore.ts
import { create } from 'zustand';
import { Investment, InvestmentModel } from '@/models/investment';
import { FirestoreService } from '@/services/firestoreService';
import { useAuthStore } from './authStore';

interface InvestmentState {
  investments: Investment[];
  investmentModels: InvestmentModel[];
  isLoading: boolean;
  
  loadInvestments: () => Promise<void>;
  addInvestment: (investment: Investment, model: InvestmentModel) => Promise<void>;
  deleteInvestment: (id: number) => Promise<void>;
  updateInvestment: (investment: Investment) => Promise<void>;
  updateModel: (model: InvestmentModel) => Promise<void>;
}

export const useInvestmentStore = create<InvestmentState>((set, get) => ({
  investments: [],
  investmentModels: [],
  isLoading: false,

  loadInvestments: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true });
    try {
      const data = await FirestoreService.loadAllData(user.uid);
      set({
        investments: data.investments || [],
        investmentModels: data.investmentModels || [],
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  addInvestment: async (investment, model) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true });
    try {
      const investments = [...get().investments, investment];
      const models = [...get().investmentModels, model];
      await FirestoreService.saveAllData(user.uid, {
        investments,
        investmentModels: models,
      });
      set({ investments, investmentModels: models, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  deleteInvestment: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ isLoading: true });
    try {
      const investments = get().investments.filter(i => i.id !== id);
      const models = get().investmentModels.filter(m => m.id !== id);
      await FirestoreService.saveAllData(user.uid, {
        investments,
        investmentModels: models,
      });
      set({ investments, investmentModels: models, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  updateInvestment: async (investment) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const investments = get().investments.map(i => i.id === investment.id ? investment : i);
    await FirestoreService.saveAllData(user.uid, { investments });
    set({ investments });
  },

  updateModel: async (model) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const models = get().investmentModels.map(m => m.id === model.id ? model : m);
    await FirestoreService.saveAllData(user.uid, { investmentModels: models });
    set({ investmentModels: models });
  },
}));