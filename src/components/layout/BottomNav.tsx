'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, TrendingDown, BarChart3, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/home',       label: 'Ana',      Icon: Home },
  { href: '/income',     label: 'Gelir',    Icon: TrendingUp },
  { href: '/outcome',    label: 'Gider',    Icon: TrendingDown },
  { href: '/investment', label: 'Yatırım',  Icon: BarChart3 },
  { href: '/account',    label: 'Hesap',    Icon: CreditCard },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                isActive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}