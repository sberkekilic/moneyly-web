'use client';

import { formatAmount } from '@/lib/formatters';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface Props {
  income: number;
  expense: number;
  balance: number;
}

export function FinancialSummaryCards({ income, expense, balance }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SummaryCard
        label="Gelir"
        amount={income}
        icon={<TrendingUp size={16} />}
        colorClass="text-green-600 bg-green-50 dark:bg-green-900/20"
      />
      <SummaryCard
        label="Gider"
        amount={expense}
        icon={<TrendingDown size={16} />}
        colorClass="text-red-500 bg-red-50 dark:bg-red-900/20"
      />
      <SummaryCard
        label="Bakiye"
        amount={balance}
        icon={<Wallet size={16} />}
        colorClass={balance >= 0
          ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
          : 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'
        }
      />
    </div>
  );
}

function SummaryCard({
  label, amount, icon, colorClass
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className={`rounded-2xl p-3 ${colorClass}`}>
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className="text-xs font-bold">{formatAmount(amount)} ₺</p>
    </div>
  );
}