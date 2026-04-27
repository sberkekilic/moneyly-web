// ============================================
// ACCOUNT SERVICE
// Converted from: lib/services/account_service.dart
// ============================================

import { Account, BankData, calculateMinPayment, getActualCutoffDate } from '@/models/account';
import { Transaction } from '@/models/transaction';
import { storage, KEYS } from './storage';
import { format, parse } from 'date-fns';

export const AccountService = {

  // ── Load all accounts ────────────────────────────────
  loadAllAccounts: (): Account[] => {
    const bankDataList = storage.get<BankData[]>(KEYS.ACCOUNT_DATA_LIST, []) ?? [];
    const accounts: Account[] = [];
    bankDataList.forEach((bank) => {
      bank.accounts.forEach((acc) => accounts.push(acc));
    });
    return accounts;
  },

  loadBankDataList: (): BankData[] => {
    return storage.get<BankData[]>(KEYS.ACCOUNT_DATA_LIST, []) ?? [];
  },

  saveBankDataList: (list: BankData[]): void => {
    storage.set(KEYS.ACCOUNT_DATA_LIST, list);
  },

  getSelectedAccount: (): Account | null => {
    const json = storage.getString(KEYS.SELECTED_ACCOUNT);
    if (!json) return null;
    try {
      const ref = JSON.parse(json) as { accountId: number; bankId: number };
      const banks = AccountService.loadBankDataList();
      for (const bank of banks) {
        const found = bank.accounts.find((a) => a.accountId === ref.accountId);
        if (found) return found;
      }
    } catch { }
    return null;
  },

  setSelectedAccount: (accountId: number, bankId: number): void => {
    storage.set(KEYS.SELECTED_ACCOUNT, { accountId, bankId });
  },

  addTransactionToAccount: (accountId: number, bankId: number, transaction: Transaction): void => {
    const banks = AccountService.loadBankDataList();
    
    for (const bank of banks) {
      if ((bank as any).bankId === bankId) {
        const account = bank.accounts.find((a: Account) => a.accountId === accountId);
        if (account) {
          // Check if transaction already exists (avoid duplicates)
          const exists = account.transactions.some(
            (t) => t.transactionId === transaction.transactionId
          );
          if (!exists) {
            account.transactions.push(transaction);
            AccountService.saveBankDataList(banks);
          }
          return;
        }
      }
    }
  },

  // ── Update account debts when transaction changes ────
  updateAccountDebts: (transaction: Transaction, isDeleting: boolean): void => {
    const banks = AccountService.loadBankDataList();
    let updated = false;

    for (const bank of banks) {
      for (const account of bank.accounts) {
        const txExists = account.transactions.some(
          (t) => t.transactionId === transaction.transactionId
        );

        if (txExists && !account.isDebit) {
          const amount = transaction.amount;
          const multiplier = isDeleting ? -1 : 1;

          account.currentDebt = (account.currentDebt ?? 0) + amount * multiplier;
          account.totalDebt = (account.totalDebt ?? 0) + amount * multiplier;
          account.availableCredit = (account.availableCredit ?? 0) - amount * multiplier;

          // Period debts
          if (account.nextCutoffDate) {
            const cutoff = parseStoredDate(account.nextCutoffDate);
            const txDate = new Date(transaction.date);
            if (txDate < cutoff) {
              if (!transaction.isProvisioned) {
                account.remainingDebt = (account.remainingDebt ?? 0) + amount * multiplier;
              }
            } else {
              account.previousDebt = (account.previousDebt ?? 0) + amount * multiplier;
            }
          }

          // Recalculate min payment
          account.minPayment = calculateMinPayment(account);
          account.remainingMinPayment = account.minPayment;

          // Remove from transactions list if deleting
          if (isDeleting) {
            account.transactions = account.transactions.filter(
              (t) => t.transactionId !== transaction.transactionId
            );
          }

          updated = true;
          break;
        }
      }
      if (updated) break;
    }

    if (updated) {
      AccountService.saveBankDataList(banks);
    }
  },

  // ── Extract all transactions from accounts ───────────
  extractAllTransactions: (): Transaction[] => {
    const banks = AccountService.loadBankDataList();
    const all: Transaction[] = [];
    const seen = new Set<number>();

    banks.forEach((bank) => {
      bank.accounts.forEach((acc) => {
        acc.transactions.forEach((tx) => {
          if (!seen.has(tx.transactionId)) {
            seen.add(tx.transactionId);
            all.push(tx);
          }
        });
      });
    });

    return all;
  },

  updateTransactionInAccounts: (updated: Transaction): void => {
    const banks = AccountService.loadBankDataList();
    for (const bank of banks) {
      for (const account of bank.accounts) {
        const idx = account.transactions.findIndex(
          (t) => t.transactionId === updated.transactionId
        );
        if (idx !== -1) {
          account.transactions[idx] = updated;
          AccountService.saveBankDataList(banks);
          return;
        }
      }
    }
  },

  deleteTransactionFromAccounts: (transactionId: number): void => {
    const banks = AccountService.loadBankDataList();
    let updated = false;
    
    for (const bank of banks) {
      for (const account of bank.accounts) {
        const before = account.transactions.length;
        account.transactions = account.transactions.filter(
          (t) => t.transactionId !== transactionId
        );
        if (account.transactions.length !== before) {
          updated = true;
          console.log(`Deleted transaction ${transactionId} from account ${account.name}`);
        }
      }
    }
    
    if (updated) {
      AccountService.saveBankDataList(banks);
    } else {
      console.warn(`Transaction ${transactionId} not found in any account`);
    }
  },

  findAccountById: (accountId: number): { account: Account; bankId: number } | null => {
    const banks = AccountService.loadBankDataList();
    for (const bank of banks) {
      const found = bank.accounts.find((a) => a.accountId === accountId);
      if (found) return { account: found, bankId: (bank as any).bankId };
    }
    return null;
  },
};

function parseStoredDate(dateStr: string): Date {
  // Handle dd/MM/yyyy format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }
  return new Date(dateStr);
}