'use client';

import { useState } from 'react';
import { useTransactionStore } from '@/store/transactionStore';
import { Transaction, TransactionType } from '@/models/transaction';
import { X, CreditCard, Receipt, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useSettingsStore } from '@/store/settingsStore';

interface EditTransactionModalProps {
  transaction: Transaction;
  accountId: number;
  bankId: number;
  isCreditCard?: boolean;
  onClose: () => void;
}

export function EditTransactionModal({
  transaction,
  accountId,
  bankId,
  isCreditCard = false,
  onClose,
}: EditTransactionModalProps) {
  const { updateTransaction } = useTransactionStore();
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  // ── Pre-fill all fields from existing transaction ──
  const [title, setTitle] = useState(transaction.title);
  const [amount, setAmount] = useState(
    transaction.totalAmount
      ? String(transaction.totalAmount)   // show total for installments
      : String(transaction.amount)
  );
  const [category, setCategory] = useState(transaction.category);
  const [subcategory, setSubcategory] = useState(transaction.subcategory);
  const [date, setDate] = useState(
    new Date(transaction.date).toISOString().split('T')[0]
  );
  const [currency, setCurrency] = useState(transaction.currency || 'TRY');
  const [isSurplus, setIsSurplus] = useState(transaction.isSurplus);
  const [description, setDescription] = useState(transaction.description || '');
  const [txType, setTxType] = useState<TransactionType>(
    transaction.transactionType ?? TransactionType.normal
  );
  const [installments, setInstallments] = useState(
    transaction.installment ? String(transaction.installment) : ''
  );

  // Installment edit scope
  const [installmentScope, setInstallmentScope] = useState<'this' | 'all'>('this');

  // Show installment scope picker if this is an installment tx
  const isInstallment = !!(transaction.installment && transaction.installment > 1);

  const t = {
    title:          lang === 'tr' ? 'İşlemi Düzenle' : 'Edit Transaction',
    txType:         lang === 'tr' ? 'İşlem Tipi' : 'Transaction Type',
    income:         lang === 'tr' ? 'Gelir mi?' : 'Is Income?',
    titleField:     lang === 'tr' ? 'Başlık *' : 'Title *',
    cat:            lang === 'tr' ? 'Kategori' : 'Category',
    subcat:         lang === 'tr' ? 'Alt Kategori' : 'Subcategory',
    totalAmt:       lang === 'tr' ? 'Toplam Tutar *' : 'Total Amount *',
    amountField:    lang === 'tr' ? 'Miktar *' : 'Amount *',
    currencyField:  lang === 'tr' ? 'Para Birimi' : 'Currency',
    installCount:   lang === 'tr' ? 'Taksit Sayısı' : 'Installment Count',
    dateField:      lang === 'tr' ? 'Tarih' : 'Date',
    desc:           lang === 'tr' ? 'Açıklama' : 'Description',
    cancel:         lang === 'tr' ? 'İptal' : 'Cancel',
    save:           lang === 'tr' ? 'Kaydet' : 'Save',
    installScope:   lang === 'tr' ? 'Taksit Düzenleme Kapsamı' : 'Installment Edit Scope',
    thisOnly:       lang === 'tr' ? 'Sadece Bu Taksit' : 'Only This Installment',
    allInstall:     lang === 'tr' ? 'Tüm Taksitler' : 'All Installments',
    thisOnlySub:    lang === 'tr' ? 'Sadece bu taksiti güncelle' : 'Update only this installment',
    allInstallSub:  lang === 'tr' ? 'Tüm taksitlerin başlık/kategori/açıklama bilgilerini güncelle' : 'Update title/category/description for all installments',
    installInfo:    lang === 'tr' ? 'Taksitli İşlem Bilgisi' : 'Installment Info',
    installWarning: lang === 'tr'
      ? 'Bu taksitli bir işlemdir. Tutarı değiştirmek sadece bu taksite yansır.'
      : 'This is an installment transaction. Amount changes apply to this installment only.',
    preview:        lang === 'tr' ? 'Taksit Önizlemesi' : 'Installment Preview',
    perInstall:     lang === 'tr' ? 'taksit başı' : 'per installment',
    total:          lang === 'tr' ? 'Toplam' : 'Total',
    creditInfo:     lang === 'tr' ? 'Kredi Kartı' : 'Credit Card',
    bankInfo:       lang === 'tr' ? 'Banka' : 'Bank',
    validationErr:  lang === 'tr' ? 'Lütfen başlık ve geçerli bir miktar girin' : 'Please enter a title and valid amount',
    success:        lang === 'tr' ? 'İşlem güncellendi' : 'Transaction updated',
    noUpdate:       lang === 'tr' ? 'İşlem güncellenemedi' : 'Failed to update transaction',
  };

  // Available types (same rule as AddTransactionModal)
  const availableTypes = isCreditCard
    ? [
        { type: TransactionType.normal,      label: lang === 'tr' ? 'Normal' : 'Normal',         icon: <CreditCard size={14} />, color: 'bg-blue-500',   desc: lang === 'tr' ? 'Tek seferlik' : 'One-time' },
        { type: TransactionType.installment, label: lang === 'tr' ? 'Taksitli' : 'Installment',  icon: <Receipt size={14} />,    color: 'bg-purple-500', desc: lang === 'tr' ? 'Çoklu taksit' : 'Multiple payments' },
        { type: TransactionType.provisioned, label: lang === 'tr' ? 'Provizyon' : 'Provisioned', icon: <Clock size={14} />,      color: 'bg-orange-500', desc: lang === 'tr' ? 'Kesinleşmemiş' : 'Not finalized' },
      ]
    : [
        { type: TransactionType.normal,      label: lang === 'tr' ? 'Normal' : 'Normal',         icon: <CreditCard size={14} />, color: 'bg-blue-500',   desc: lang === 'tr' ? 'Tek seferlik' : 'One-time' },
      ];

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!title.trim() || !parsedAmount || parsedAmount <= 0) {
      toast.error(t.validationErr);
      return;
    }

    // Recalculate amounts for installments
    const installmentCount =
      txType === TransactionType.installment
        ? parseInt(installments) || transaction.installment || 1
        : null;

    const totalAmount =
      installmentCount && installmentCount > 1 ? parsedAmount : null;

    const installmentAmount = totalAmount
      ? totalAmount / installmentCount!
      : parsedAmount;

    const updatedTx: Transaction = {
      ...transaction,                    // keep all original fields
      title: title.trim(),
      amount: installmentAmount,
      totalAmount,
      category: category.trim() || 'Diğer',
      subcategory: subcategory.trim() || 'Genel',
      date: new Date(date).toISOString(),
      currency,
      isSurplus,
      description: description.trim(),
      isProvisioned: txType === TransactionType.provisioned,
      installment: installmentCount,
      transactionType: txType,
    };

    try {
      await updateTransaction(
        updatedTx,
        accountId,
        bankId,
        isInstallment && installmentScope === 'all'
      );
      toast.success(t.success);
      onClose();
    } catch {
      toast.error(t.noUpdate);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              ID: #{transaction.transactionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* ── Account Badge ── */}
        <div className={cn(
          'flex items-center gap-2 p-3 rounded-xl text-xs font-medium',
          isCreditCard
            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600'
        )}>
          <CreditCard size={14} />
          <span className="flex-1">
            {isCreditCard ? t.creditInfo : t.bankInfo}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-white/50 dark:bg-gray-800/50">
            {transaction.currency}
          </span>
        </div>

        {/* ── Installment Scope Picker ── */}
        {isInstallment && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{t.installInfo}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">{t.installWarning}</p>
                <p className="text-xs text-amber-500 mt-1">
                  {lang === 'tr'
                    ? `Taksit: ${transaction.currentInstallment ?? 1}/${transaction.installment}`
                    : `Installment: ${transaction.currentInstallment ?? 1}/${transaction.installment}`}
                </p>
              </div>
            </div>

            {/* Scope toggle */}
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                {t.installScope}
              </p>
              <div className="flex gap-2">
                {([
                  { key: 'this', label: t.thisOnly, sub: t.thisOnlySub },
                  { key: 'all',  label: t.allInstall, sub: t.allInstallSub },
                ] as const).map(({ key, label, sub }) => (
                  <button
                    key={key}
                    onClick={() => setInstallmentScope(key)}
                    className={cn(
                      'flex-1 p-3 rounded-xl border-2 text-left transition-all',
                      installmentScope === key
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-amber-300'
                    )}
                  >
                    <p className={cn(
                      'text-xs font-bold',
                      installmentScope === key
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-gray-700 dark:text-gray-300'
                    )}>
                      {label}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Transaction Type ── */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t.txType}</p>
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
        </div>

        {/* ── Income Toggle ── */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.income}</p>
          <button
            onClick={() => setIsSurplus(!isSurplus)}
            className={cn(
              'w-12 h-6 rounded-full transition-colors',
              isSurplus ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <div className={cn(
              'w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5',
              isSurplus ? 'translate-x-6' : 'translate-x-0'
            )} />
          </button>
        </div>

        {/* ── Form Fields ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Title */}
          <div className="md:col-span-2">
            <FieldLabel>{t.titleField}</FieldLabel>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'tr' ? 'İşlem başlığı' : 'Transaction title'}
              className={FIELD_CLASS}
            />
          </div>

          {/* Category */}
          <div>
            <FieldLabel>{t.cat}</FieldLabel>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={lang === 'tr' ? 'Örn: Gıda' : 'e.g. Food'}
              className={FIELD_CLASS}
            />
          </div>

          {/* Subcategory */}
          <div>
            <FieldLabel>{t.subcat}</FieldLabel>
            <input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder={lang === 'tr' ? 'Örn: Market' : 'e.g. Grocery'}
              className={FIELD_CLASS}
            />
          </div>

          {/* Amount */}
          <div>
            <FieldLabel>
              {txType === TransactionType.installment ? t.totalAmt : t.amountField}
            </FieldLabel>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={FIELD_CLASS}
            />
          </div>

          {/* Currency */}
          <div>
            <FieldLabel>{t.currencyField}</FieldLabel>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          {/* Installment count */}
          {txType === TransactionType.installment && isCreditCard && (
            <div>
              <FieldLabel>{t.installCount}</FieldLabel>
              <input
                type="number"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                placeholder="12"
                className={FIELD_CLASS}
              />
            </div>
          )}

          {/* Date */}
          <div>
            <FieldLabel>{t.dateField}</FieldLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <FieldLabel>{t.desc}</FieldLabel>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === 'tr' ? 'Opsiyonel' : 'Optional'}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        {/* ── Installment Preview ── */}
        {txType === TransactionType.installment && amount && installments && (
          <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
            <p className="text-xs font-bold text-purple-600 mb-1">{t.preview}</p>
            <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">
              {parseInt(installments) || 1}x{' '}
              {((parseFloat(amount) || 0) / (parseInt(installments) || 1)).toFixed(2)} ₺
              <span className="text-xs font-normal ml-1 opacity-70">{t.perInstall}</span>
            </p>
            <p className="text-xs text-purple-400">
              {t.total}: {parseFloat(amount).toFixed(2)} ₺
            </p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

const FIELD_CLASS = [
  'w-full rounded-xl px-4 py-3 text-sm outline-none',
  'bg-gray-50 dark:bg-gray-800',
  'border border-gray-200 dark:border-gray-700',
  'text-gray-900 dark:text-white',
  'focus:ring-2 focus:ring-blue-500',
  'transition-colors',
].join(' ');

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
      {children}
    </p>
  );
}