// src/app/(main)/investment/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useInvestmentStore } from '@/store/investmentStore';
import { Investment, InvestmentModel, createInvestment } from '@/models/investment';
import { formatAmount } from '@/lib/formatters';
import {
  DollarSign, Wallet, Home, Car, Monitor, Folder,
  Plus, Trash2, ArrowLeft, Inbox, TrendingUp, Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { useSettingsStore } from '@/store/settingsStore';

// ── Types & Constants ──────────────────────────────────────

type Currency = 'Dolar' | 'Euro' | 'Türk Lirası';

const CURRENCIES: { key: Currency; symbol: string; flag: string }[] = [
  { key: 'Dolar',       symbol: '$', flag: '🇺🇸' },
  { key: 'Euro',        symbol: '€', flag: '🇪🇺' },
  { key: 'Türk Lirası', symbol: '₺', flag: '🇹🇷' },
];

const ALL_CATEGORIES = ['Döviz', 'Nakit', 'Gayrimenkül', 'Araba', 'Elektronik', 'Diğer'];

const categoryIcon: Record<string, React.ReactNode> = {
  'Döviz':       <DollarSign size={16} />,
  'Nakit':       <Wallet size={16} />,
  'Gayrimenkül': <Home size={16} />,
  'Araba':       <Car size={16} />,
  'Elektronik':  <Monitor size={16} />,
  'Diğer':       <Folder size={16} />,
};

const categoryColor: Record<string, string> = {
  'Döviz':       'bg-emerald-500',
  'Nakit':       'bg-blue-500',
  'Gayrimenkül': 'bg-orange-500',
  'Araba':       'bg-purple-500',
  'Elektronik':  'bg-pink-500',
  'Diğer':       'bg-gray-500',
};

// ── Main Component ─────────────────────────────────────────

export default function InvestmentPage() {
  const { investments, investmentModels, loadInvestments, addInvestment, deleteInvestment, updateModel } = useInvestmentStore();
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('Dolar');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const t = {
    title:        lang === 'tr' ? 'Birikimlerim' : 'My Savings',
    totalSavings: lang === 'tr' ? 'Toplam Birikim' : 'Total Savings',
    target:       lang === 'tr' ? 'Hedef' : 'Target',
    saved:        lang === 'tr' ? 'Biriken' : 'Saved',
    remaining:    lang === 'tr' ? 'Kalan' : 'Remaining',
    addGoal:      lang === 'tr' ? 'Yeni Birikim Hedefi Ekle' : 'Add New Savings Goal',
    goals:        lang === 'tr' ? 'hedef' : 'goal(s)',
    noGoals:      lang === 'tr' ? 'Bu para biriminde hedef yok' : 'No goals in this currency',
    addHint:      lang === 'tr' ? 'Yukarıdaki butona tıklayarak ekleyin' : 'Click the button above to add',
    completed:    lang === 'tr' ? 'Tamamlandı!' : 'Completed!',
    left:         lang === 'tr' ? 'kaldı' : 'remaining',
    add:          lang === 'tr' ? 'Ekle' : 'Add',
    remove:       lang === 'tr' ? 'Çıkar' : 'Remove',
    pickCat:      lang === 'tr' ? 'Kategori Seçin' : 'Pick Category',
    pickCatSub:   lang === 'tr' ? 'Birikiminizin türünü seçin' : 'Choose savings type',
    goalTarget:   lang === 'tr' ? 'Hedef Tarih' : 'Target Date',
    overview:     lang === 'tr' ? 'Genel Bakış' : 'Overview',
    distribution: lang === 'tr' ? 'Dağılım' : 'Distribution',
  };

  useEffect(() => {
    loadInvestments().finally(() => setIsLoading(false));
  }, []);

  const filtered = investments.filter((i) => i.currency === selectedCurrency);
  const grouped = filtered.reduce((acc, inv) => {
    if (!acc[inv.category]) acc[inv.category] = [];
    acc[inv.category].push(inv);
    return acc;
  }, {} as Record<string, Investment[]>);

  const findModel = (inv: Investment): InvestmentModel =>
    investmentModels.find((m) => m.id === inv.id) ??
    { id: inv.id, aim: 0, amount: parseFloat(inv.amount) || 0 };

  const totalTarget = filtered.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const totalSaved = filtered.reduce((s, i) => s + findModel(i).aim, 0);
  const progress = totalTarget > 0 ? Math.min(totalSaved / totalTarget, 1) : 0;

  const handleAddToSavings = (id: number, value: number) => {
    const inv = investments.find((i) => i.id === id);
    if (!inv) return;
    const model = findModel(inv);
    const target = parseFloat(inv.amount) || 0;
    const newAim = Math.min(model.aim + value, target);
    updateModel({ ...model, aim: newAim });
  };

  const handleRemoveFromSavings = (id: number, value: number) => {
    const inv = investments.find((i) => i.id === id);
    if (!inv) return;
    const model = findModel(inv);
    const newAim = Math.max(model.aim - value, 0);
    updateModel({ ...model, aim: newAim });
  };

  const handleAddInvestment = (investment: Investment, model: InvestmentModel) => {
    addInvestment(investment, model);
    setShowAddModal(null);
    toast.success(lang === 'tr' ? 'Birikim hedefi eklendi' : 'Savings goal added');
  };

  // Category distribution for summary
  const categoryDistribution = Object.entries(grouped).map(([cat, items]) => {
    const catTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const catSaved = items.reduce((s, i) => s + findModel(i).aim, 0);
    return { category: cat, target: catTotal, saved: catSaved, count: items.length };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/home" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden">
              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
          </div>
          <button
            onClick={() => setShowCategoryPicker(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{t.addGoal}</span>
            <span className="sm:hidden">{t.add}</span>
          </button>
        </div>

        {/* ── Top Row: Summary + Distribution (side-by-side on desktop) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Summary Card — wider */}
          <div className="lg:col-span-3">
            <SummaryCard
              totalSaved={totalSaved}
              totalTarget={totalTarget}
              progress={progress}
              currencySymbol={currencySymbol}
              t={t}
            />
          </div>

          {/* Distribution Card — narrower */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{t.distribution}</h3>
            {categoryDistribution.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">{t.noGoals}</p>
            ) : (
              <div className="space-y-3">
                {categoryDistribution.map(({ category, target, saved, count }) => {
                  const pct = target > 0 ? (saved / target) * 100 : 0;
                  const color = categoryColor[category] || 'bg-gray-500';
                  return (
                    <div key={category} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{category}</span>
                          <span className="text-[10px] text-gray-400">({count})</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                          {currencySymbol}{formatAmount(saved)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={cn('h-1.5 rounded-full transition-all', color)}
                          style={{ width: `${Math.min(pct, 100).toFixed(0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Currency Selector ── */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
          {CURRENCIES.map(({ key, symbol, flag }) => (
            <button
              key={key}
              onClick={() => { setSelectedCurrency(key); setCurrencySymbol(symbol); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
                selectedCurrency === key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              <span className="hidden md:inline">{flag}</span>
              {key}
            </button>
          ))}
        </div>

        {/* ── Add Button (full width on mobile, inline on desktop) ── */}
        <button
          onClick={() => setShowCategoryPicker(true)}
          className="w-full lg:hidden flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-2xl font-semibold transition-colors"
        >
          <Plus size={18} />
          {t.addGoal}
        </button>

        {/* ── Goals Grid ── */}
        {Object.keys(grouped).length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <GoalGroup
                key={category}
                category={category}
                items={items}
                models={investmentModels}
                currencySymbol={currencySymbol}
                onAdd={handleAddToSavings}
                onRemove={handleRemoveFromSavings}
                onDelete={(id: number) => {
                  deleteInvestment(id);
                  toast.success(lang === 'tr' ? 'Hedef silindi' : 'Goal deleted');
                }}
                t={t}
              />
            ))}
          </div>
        )}

        {/* ── Modals ── */}
        {showCategoryPicker && (
          <CategoryPickerModal
            onSelect={(cat: string) => { setShowCategoryPicker(false); setShowAddModal(cat); }}
            onClose={() => setShowCategoryPicker(false)}
            t={t}
          />
        )}

        {showAddModal && (
          <AddInvestmentModal
            category={showAddModal}
            currency={selectedCurrency}
            currencySymbol={currencySymbol}
            onSave={handleAddInvestment}
            onClose={() => setShowAddModal(null)}
            t={t}
          />
        )}
      </div>
    </AuthGuard>
  );
}

// ── Summary Card ──────────────────────────────────────────

function SummaryCard({ totalSaved, totalTarget, progress, currencySymbol, t }: any) {
  const remaining = Math.max(totalTarget - totalSaved, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-500" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t.totalSavings}</p>
        </div>
        <div className={cn(
          'px-3 py-1 rounded-full text-xs font-bold',
          progress >= 1
            ? 'bg-green-100 dark:bg-green-900/20 text-green-600'
            : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
        )}>
          %{(progress * 100).toFixed(0)}
        </div>
      </div>

      <div>
        <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
          {currencySymbol} {formatAmount(totalSaved)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t.target}: {currencySymbol} {formatAmount(totalTarget)}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
        <div
          className={cn(
            'h-3 rounded-full transition-all duration-500',
            progress >= 1 ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${(progress * 100).toFixed(0)}%` }}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t.saved,     value: `${currencySymbol}${formatAmount(totalSaved)}`,    color: 'text-green-600 bg-green-50 dark:bg-green-900/10' },
          { label: t.remaining, value: `${currencySymbol}${formatAmount(remaining)}`,     color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/10' },
          { label: t.target,    value: `${currencySymbol}${formatAmount(totalTarget)}`,   color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/10' },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-xl p-3', stat.color)}>
            <p className="text-[10px] font-medium opacity-70">{stat.label}</p>
            <p className="text-sm font-bold mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Goal Group ────────────────────────────────────────────

function GoalGroup({ category, items, models, currencySymbol, onAdd, onRemove, onDelete, t }: any) {
  const findModel = (inv: Investment) =>
    models.find((m: InvestmentModel) => m.id === inv.id) ?? { id: inv.id, aim: 0, amount: 0 };

  const color = categoryColor[category] || 'bg-gray-500';

  return (
    <div className="space-y-3">
      {/* Category Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-2 rounded-xl text-white', color)}>
            {categoryIcon[category] ?? <Folder size={16} />}
          </div>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{category}</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg font-medium">
          {items.length} {t.goals}
        </span>
      </div>

      {/* Goal Cards — 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((inv: Investment) => {
          const model = findModel(inv);
          const target = parseFloat(inv.amount) || 0;
          const p = target > 0 ? Math.min(model.aim / target, 1) : 0;
          const isComplete = p >= 1;

          return (
            <div
              key={inv.id}
              className={cn(
                'bg-white dark:bg-gray-800 rounded-2xl border p-5 space-y-4 transition-all hover:shadow-md',
                isComplete
                  ? 'border-green-200 dark:border-green-800'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              {/* Title row */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{inv.name}</p>
                  {inv.deadline && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.goalTarget}: {new Date(inv.deadline).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  {isComplete && (
                    <span className="text-xs font-semibold text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-lg">
                      ✓
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(inv.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {currencySymbol}{formatAmount(model.aim)}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {currencySymbol}{formatAmount(target)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className={cn(
                      'h-2.5 rounded-full transition-all duration-500',
                      isComplete ? 'bg-green-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${(p * 100).toFixed(0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className={cn(
                    'font-bold',
                    isComplete ? 'text-green-500' : 'text-blue-500'
                  )}>
                    %{(p * 100).toFixed(0)}
                  </span>
                  <span className={cn('font-semibold', isComplete ? 'text-green-500' : 'text-gray-500 dark:text-gray-400')}>
                    {isComplete
                      ? `✓ ${t.completed}`
                      : `${currencySymbol}${formatAmount(Math.max(target - model.aim, 0))} ${t.left}`}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <AmountButton
                  label={t.add}
                  icon={<Plus size={14} />}
                  color="bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  onSubmit={(val) => onAdd(inv.id, val)}
                />
                {model.aim > 0 && (
                  <AmountButton
                    label={t.remove}
                    icon={<Minus size={14} />}
                    color="bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                    onSubmit={(val) => onRemove(inv.id, val)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Amount Button (Add / Remove) ──────────────────────────

function AmountButton({ label, icon, color, onSubmit }: {
  label: string;
  icon: React.ReactNode;
  color: string;
  onSubmit: (val: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');

  const submit = () => {
    const n = parseFloat(val);
    if (n > 0) { onSubmit(n); setOpen(false); setVal(''); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors',
          color
        )}
      >
        {icon} {label}
      </button>
    );
  }

  return (
    <div className="flex-1 flex gap-1.5">
      <input
        autoFocus
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="0"
        className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
      />
      <button
        onClick={submit}
        className="px-3 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors"
      >
        ✓
      </button>
      <button
        onClick={() => { setOpen(false); setVal(''); }}
        className="px-2 text-gray-400 hover:text-gray-600 text-sm"
      >
        ✕
      </button>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────

function CategoryPickerModal({ onSelect, onClose, t }: any) {
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t.pickCat}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t.pickCatSub}</p>
        <div className="grid grid-cols-3 gap-3">
          {ALL_CATEGORIES.map((cat) => {
            const color = categoryColor[cat] || 'bg-gray-500';
            return (
              <button
                key={cat}
                onClick={() => onSelect(cat)}
                className="flex flex-col items-center gap-2.5 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
              >
                <div className={cn('p-3 rounded-xl text-white', color)}>
                  {categoryIcon[cat] ?? <Folder size={18} />}
                </div>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">{cat}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          {lang === 'tr' ? 'İptal' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function AddInvestmentModal({ category, currency, currencySymbol, onSave, onClose, t }: any) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const { language } = useSettingsStore();
  const lang = language || 'tr';

  const handleSave = () => {
    if (!name.trim() || !amount) {
      toast.error(lang === 'tr' ? 'İsim ve hedef tutarı girin' : 'Enter name and target amount');
      return;
    }
    const inv = createInvestment({ name: name.trim(), category, currency, amount, deadline: deadline || undefined });
    const model: InvestmentModel = { id: inv.id, aim: 0, amount: parseFloat(amount) || 0 };
    onSave(inv, model);
  };

  const color = categoryColor[category] || 'bg-gray-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with category badge */}
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl text-white', color)}>
            {categoryIcon[category] ?? <Folder size={18} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {category} {lang === 'tr' ? 'Hedefi Ekle' : 'Add Goal'}
            </h3>
            <p className="text-xs text-gray-400">{currency} ({currencySymbol})</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
              {lang === 'tr' ? 'İsim' : 'Name'}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'tr' ? 'Örn: iPhone 16' : 'Ex: iPhone 16'}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
              {lang === 'tr' ? 'Hedef Tutar' : 'Target Amount'} ({currencySymbol})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
              {t.goalTarget} ({lang === 'tr' ? 'opsiyonel' : 'optional'})
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {lang === 'tr' ? 'İptal' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {lang === 'tr' ? 'Kaydet' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ t }: any) {
  return (
    <div className="flex flex-col items-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-4">
        <Inbox size={32} className="text-gray-300 dark:text-gray-500" />
      </div>
      <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-1">{t.noGoals}</p>
      <p className="text-sm text-gray-400">{t.addHint}</p>
    </div>
  );
}