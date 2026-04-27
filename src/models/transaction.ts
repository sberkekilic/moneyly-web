// ============================================
// TRANSACTION MODEL
// Converted from: lib/models/transaction.dart
// ============================================

export enum TransactionType {
  normal = 0,
  installment = 1,
  provisioned = 2,
}

export const TransactionTypeInfo = {
  [TransactionType.normal]: {
    title: 'Normal İşlem',
    subtitle: 'Tek seferlik ödeme',
    icon: 'payment',
    color: '#3B82F6',
    description: '• Tek seferde ödenen işlem\n• Hemen hesaba yansır\n• Tarih seçimi zorunlu',
  },
  [TransactionType.installment]: {
    title: 'Taksitli İşlem',
    subtitle: 'Birden fazla ödeme planı',
    icon: 'receipt_long',
    color: '#8B5CF6',
    description: '• Birden fazla taksit\n• İlk taksit tarihi zorunlu\n• Taksit sayısı zorunlu',
  },
  [TransactionType.provisioned]: {
    title: 'Provizyonlu İşlem',
    subtitle: 'Otomatik normal işleme dönüşür',
    icon: 'pending_actions',
    color: '#F97316',
    description: '• Henüz ödenmemiş işlem\n• Otomatik normal işleme dönüşür',
  },
};

export interface Transaction {
  transactionId: number;
  date: string;               // ISO string (DateTime → string)
  amount: number;
  installment?: number;       // Total installment count
  currency: string;
  subcategory: string;
  category: string;
  title: string;
  description: string;
  isSurplus: boolean;
  isFromInvoice: boolean;
  initialInstallmentDate?: string;
  isProvisioned: boolean;
  currentInstallment?: number;
  totalAmount?: number;
  isInstallmentCompleted?: boolean;
  transactionType?: TransactionType;
  parentTransactionId?: number;
  installmentIndex?: number;
  isInstallmentPaid?: boolean;
  paidAmount?: number;
}

// ── Computed helpers (replaces Dart getters) ──────────────────────

export const isInstallmentTx = (t: Transaction): boolean =>
  t.installment != null && t.installment > 1;

export const getInstallmentAmount = (t: Transaction): number => {
  if (t.installment && t.installment > 0) {
    return t.totalAmount != null ? t.totalAmount / t.installment : t.amount;
  }
  return t.amount;
};

export const getTotalTransactionAmount = (t: Transaction): number => {
  if (t.installment && t.installment > 1 && t.totalAmount != null) {
    return t.totalAmount;
  }
  return t.amount;
};

export const getCurrentInstallmentPeriod = (t: Transaction): string => {
  if (!t.installment || t.installment <= 0) return '';
  if (t.currentInstallment != null) return `${t.currentInstallment}/${t.installment}`;
  return `1/${t.installment}`;
};

export const getInstallmentPosition = (t: Transaction): number => {
  if (!isInstallmentTx(t) || !t.initialInstallmentDate) return 1;
  const initial = new Date(t.initialInstallmentDate);
  const current = new Date(t.date);
  const monthsDiff =
    (current.getFullYear() - initial.getFullYear()) * 12 +
    (current.getMonth() - initial.getMonth());
  return monthsDiff + 1;
};

// ── Factory / Constructor helpers ─────────────────────────────────

export const createTransaction = (
  partial: Partial<Transaction> & Pick<Transaction, 'title' | 'amount' | 'category'>
): Transaction => ({
  transactionId: Date.now(),
  date: new Date().toISOString(),
  currency: 'TRY',
  subcategory: '',
  description: '',
  isSurplus: false,
  isFromInvoice: false,
  initialInstallmentDate: null,  // Use null instead of undefined
  isProvisioned: false,
  isInstallmentCompleted: false,
  isInstallmentPaid: false,
  paidAmount: 0,
  installment: null,  // Use null instead of undefined
  currentInstallment: null,  // Use null instead of undefined
  totalAmount: null,  // Use null instead of undefined
  transactionType: TransactionType.normal,
  parentTransactionId: null,  // Use null instead of undefined
  installmentIndex: null,  // Use null instead of undefined
  ...partial,
});


export const copyTransaction = (
  t: Transaction,
  overrides: Partial<Transaction>
): Transaction => ({ ...t, ...overrides });