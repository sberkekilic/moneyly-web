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
  updateModel: (model: InvestmentModel) => Promise<void>;
  setInvestments: (investments: Investment[]) => void;
  setInvestmentModels: (models: InvestmentModel[]) => void;
}

export const useInvestmentStore = create<InvestmentState>((set, get) => ({
  investments: [],
  investmentModels: [],
  isLoading: false,

  setInvestments: (investments) => set({ investments }),
  setInvestmentModels: (investmentModels) => set({ investmentModels }),

  loadInvestments: async () => {
    const user = useAuthStore.getState().user;
    if (!user) { set({ investments: [], investmentModels: [] }); return; }
    set({ isLoading: true });
    try {
      const data = await FirestoreService.loadAllData(user.uid);
      set({
        investments: data.investments ?? [],
        investmentModels: data.investmentModels ?? [],
        isLoading: false,
      });
    } catch (e) {
      console.error('Error loading investments:', e);
      set({ isLoading: false });
    }
  },

  addInvestment: async (investment, model) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { investments, investmentModels } = get();
    const updatedInvestments = [...investments, investment];
    const updatedModels = [...investmentModels, model];
    set({ investments: updatedInvestments, investmentModels: updatedModels });
    await FirestoreService.saveAllData(user.uid, {
      investments: updatedInvestments,
      investmentModels: updatedModels,
    });
  },

  deleteInvestment: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { investments, investmentModels } = get();
    const updatedInvestments = investments.filter((i) => i.id !== id);
    const updatedModels = investmentModels.filter((m) => m.id !== id);
    set({ investments: updatedInvestments, investmentModels: updatedModels });
    await FirestoreService.saveAllData(user.uid, {
      investments: updatedInvestments,
      investmentModels: updatedModels,
    });
  },

  updateModel: async (model) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { investments, investmentModels } = get();
    const updatedModels = investmentModels.map((m) =>
      m.id === model.id ? model : m
    );
    set({ investmentModels: updatedModels });
    await FirestoreService.saveAllData(user.uid, {
      investments,
      investmentModels: updatedModels,
    });
  },
}));