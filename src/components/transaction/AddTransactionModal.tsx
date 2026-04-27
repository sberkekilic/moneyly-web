'use client';

import { useState } from 'react';
import { useTransactionStore } from '@/store/transactionStore';
import { TransactionType, createTransaction } from '@/models/transaction';
import { X, CreditCard, Receipt, Clock } from 'lucide-react';
import { AccountService } from '@/services/accountService';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface AddTransactionModalProps {
  accounts: any[];
  selectedAccount: any;
  isCreditCard?: boolean;
  onClose: () => void;
}

export function AddTransactionModal({
  accounts,
  selectedAccount,
  isCreditCard = false,
  onClose,
}: AddTransactionModalProps) {
  const { addTransaction } = useTransactionStore();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [txType, setTxType] = useState<TransactionType>(TransactionType.normal);
  const [installments, setInstallments] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [isSurplus, setIsSurplus] = useState(false);
  const [description, setDescription] = useState('');

  // ── FIX: Determine available transaction types ──
  // Bank accounts: ONLY normal
  // Credit cards:  normal + installment + provisioned
  const availableTypes = isCreditCard
    ? [
        { type: TransactionType.normal,      label: 'Normal',    icon: <CreditCard size={14} />, color: 'bg-blue-500',   desc: 'Tek seferlik ödeme' },
        { type: TransactionType.installment, label: 'Taksitli',  icon: <Receipt size={14} />,    color: 'bg-purple-500', desc: 'Birden fazla taksit' },
        { type: TransactionType.provisioned, label: 'Provizyon', icon: <Clock size={14} />,      color: 'bg-orange-500', desc: 'Henüz kesinleşmemiş' },
      ]
    : [
        { type: TransactionType.normal,      label: 'Normal',    icon: <CreditCard size={14} />, color: 'bg-blue-500',   desc: 'Tek seferlik ödeme' },
      ];

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!title.trim() || !parsedAmount || parsedAmount <= 0) {
      toast.error('Lütfen başlık ve geçerli bir miktar girin');
      return;
    }

    // ── null → undefined ──────────────────────────────────
    const installmentCount: number | undefined =
      txType === TransactionType.installment
        ? parseInt(installments) || 1
        : undefined;

    const totalAmount: number | undefined =
      installmentCount && installmentCount > 1
        ? parsedAmount
        : undefined;

    const installmentAmount = totalAmount
      ? totalAmount / installmentCount!
      : parsedAmount;

    const newTx = createTransaction({
      title: title.trim(),
      amount: installmentAmount,
      totalAmount,                              // number | undefined ✅
      category: category.trim() || 'Diğer',
      subcategory: subcategory.trim() || 'Genel',
      date: new Date(date).toISOString(),
      isSurplus,
      currency,
      description: description.trim(),
      isFromInvoice: false,
      isProvisioned: txType === TransactionType.provisioned,
      installment: installmentCount,            // number | undefined ✅
      transactionType: txType,
      currentInstallment: installmentCount ? 1 : undefined, // ✅
    });

    if (selectedAccount?.accountId && selectedAccount?.bankId) {
      AccountService.addTransactionToAccount(
        selectedAccount.accountId,
        selectedAccount.bankId,
        newTx
      );
    }

    await addTransaction(newTx, selectedAccount.accountId, selectedAccount.bankId);
    toast.success('İşlem eklendi');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">İşlem Ekle</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Account Info */}
        {selectedAccount && (
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-xl text-xs font-medium',
            isCreditCard
              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600'
              : 'bg-green-50 dark:bg-green-900/20 text-green-600'
          )}>
            {isCreditCard ? <CreditCard size={14} /> : <CreditCard size={14} />}
            {selectedAccount.bankName} — {selectedAccount.name}
            <span className="ml-auto px-2 py-0.5 rounded-md bg-white/50 dark:bg-gray-800/50">
              {isCreditCard ? 'Kredi Kartı' : 'Banka'}
            </span>
          </div>
        )}

        {/* Transaction Type Selector */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">İşlem Tipi</p>
          <div className="flex gap-2">
            {availableTypes.map(({ type, label, icon, color, desc }) => (
              <button
                key={type}
                onClick={() => setTxType(type)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all',
                  txType === type
                    ? `${color} text-white border-transparent shadow-lg`
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                )}
              >
                {icon}
                <span className="text-xs font-semibold">{label}</span>
                {txType === type && (
                  <span className="text-[9px] opacity-80">{desc}</span>
                )}
              </button>
            ))}
          </div>

          {/* Info text for bank accounts */}
          {!isCreditCard && (
            <p className="text-[10px] text-gray-400 mt-2 italic">
              💡 Taksit ve provizyon seçenekleri sadece kredi kartları için geçerlidir.
            </p>
          )}
        </div>

        {/* Surplus Toggle */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Gelir mi?</p>
          <button
            onClick={() => setIsSurplus(!isSurplus)}
            className={cn(
              'w-12 h-6 rounded-full transition-colors',
              isSurplus ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5',
                isSurplus ? 'translate-x-6' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {/* Form Fields - Grid layout for desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <FieldLabel>Başlık *</FieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="İşlem başlığı"
              className="field-input"
            />
          </div>

          <div>
            <FieldLabel>Kategori</FieldLabel>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Örn: Gıda"
              className="field-input"
            />
          </div>

          <div>
            <FieldLabel>Alt Kategori</FieldLabel>
            <input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Örn: Market"
              className="field-input"
            />
          </div>

          <div>
            <FieldLabel>
              {txType === TransactionType.installment
                ? 'Toplam Tutar *'
                : 'Miktar *'}
            </FieldLabel>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="field-input"
            />
          </div>

          <div>
            <FieldLabel>Para Birimi</FieldLabel>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="field-input"
            >
              <option>TRY</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>

          {/* Installment count — only for credit card + installment type */}
          {txType === TransactionType.installment && isCreditCard && (
            <div>
              <FieldLabel>Taksit Sayısı</FieldLabel>
              <input
                type="number"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                placeholder="Örn: 12"
                className="field-input"
              />
            </div>
          )}

          <div>
            <FieldLabel>Tarih</FieldLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field-input"
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Açıklama</FieldLabel>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsiyonel"
              className="field-input"
            />
          </div>
        </div>

        {/* Amount preview for installments */}
        {txType === TransactionType.installment && amount && installments && (
          <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3 text-sm">
            <p className="text-purple-600 font-semibold">
              Taksit: {parseInt(installments) || 1}x{' '}
              {((parseFloat(amount) || 0) / (parseInt(installments) || 1)).toFixed(2)} ₺
            </p>
            <p className="text-purple-400 text-xs">
              Toplam: {parseFloat(amount).toFixed(2)} ₺
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Kaydet
          </button>
        </div>
      </div>

      {/* Scoped styles for field inputs */}
      <style jsx>{`
        .field-input {
          width: 100%;
          background-color: rgb(249 250 251);
          border: 1px solid rgb(229 231 235);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: rgb(17 24 39);
          outline: none;
        }
        .field-input:focus {
          box-shadow: 0 0 0 2px rgb(59 130 246);
        }
        :global(.dark) .field-input {
          background-color: rgb(31 41 55);
          border-color: rgb(55 65 81);
          color: white;
        }
      `}</style>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
      {children}
    </p>
  );
}