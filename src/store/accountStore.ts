// store/accountStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectedAccount {
  accountId: number;
  bankId: number;
  bankName: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isDebit: boolean;
  cutoffDate?: number;
  creditLimit?: number;
  availableCredit?: number;
  totalDebt?: number;
  [key: string]: any;
}

interface AccountStore {
  selectedAccount: SelectedAccount | null;
  setSelectedAccount: (account: SelectedAccount | null) => void;
  clearSelectedAccount: () => void;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      selectedAccount: null,
      setSelectedAccount: (account) => set({ selectedAccount: account }),
      clearSelectedAccount: () => set({ selectedAccount: null }),
    }),
    {
      name: 'selected-account-storage',
    }
  )
);