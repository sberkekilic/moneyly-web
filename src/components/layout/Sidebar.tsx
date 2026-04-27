'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Home, TrendingUp, TrendingDown, BarChart3,
  CreditCard, Settings, Sun, Moon, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

const NAV_ITEMS = [
  { href: '/home',       label: { tr: 'Anasayfa',   en: 'Home' },        icon: Home },
  { href: '/income',     label: { tr: 'Gelirler',   en: 'Income' },      icon: TrendingUp },
  { href: '/outcome',    label: { tr: 'Giderler',   en: 'Expenses' },    icon: TrendingDown },
  { href: '/investment', label: { tr: 'Yatırımlar', en: 'Investments' }, icon: BarChart3 },
  { href: '/account',    label: { tr: 'Hesaplar',   en: 'Accounts' },    icon: CreditCard },
  { href: '/settings',   label: { tr: 'Ayarlar',    en: 'Settings' },    icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useSettingsStore();
  const { user, profile, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const lang = language || 'tr';

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme === 'dark' : false;

  // ── Derive user display info from auth store ──
  const displayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (lang === 'tr' ? 'Kullanıcı' : 'User');

  const email = profile?.email || user?.email || '';

  const initials = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    const msg = lang === 'tr'
      ? 'Çıkış yapmak istediğinize emin misiniz?'
      : 'Are you sure you want to logout?';
    if (confirm(msg)) {
      await logout();
      window.location.href = '/login';
    }
  };

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40">
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-100 dark:border-gray-800">
        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">M</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Moneyly</h1>
          <p className="text-[10px] text-gray-400">
            {lang === 'tr' ? 'Kişisel Finans' : 'Personal Finance'}
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.5} />
              {label[lang]}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Theme & Language ── */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          {mounted ? (
            isDark
              ? <Moon size={18} className="text-blue-400" />
              : <Sun size={18} className="text-yellow-500" />
          ) : (
            <div className="w-[18px] h-[18px]" />
          )}
          <span className="flex-1 text-left">
            {mounted
              ? isDark
                ? lang === 'tr' ? 'Karanlık' : 'Dark'
                : lang === 'tr' ? 'Aydınlık' : 'Light'
              : '...'}
          </span>
          <div
            className={cn(
              'w-9 h-5 rounded-full transition-colors relative',
              isDark ? 'bg-green-600' : 'bg-gray-300'
            )}
          >
            <div
              className={cn(
                'w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all',
                isDark ? 'left-[18px]' : 'left-0.5'
              )}
            />
          </div>
        </button>

        {/* Language Toggle */}
        <div className="flex gap-1 px-2">
          <button
            onClick={() => setLanguage('tr')}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center',
              language === 'tr'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            🇹🇷 Türkçe
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center',
              language === 'en'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* ── User Info from Firebase Auth ── */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        {user ? (
          /* Logged in — show real user data */
          <div className="flex items-center gap-3 px-2 py-2">
            {/* Avatar with user initial */}
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                {initials}
              </span>
            </div>

            {/* User details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {email}
              </p>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
              title={lang === 'tr' ? 'Çıkış Yap' : 'Logout'}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          /* Not logged in — show login prompt */
          <Link
            href="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">?</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                {lang === 'tr' ? 'Giriş Yap' : 'Login'}
              </p>
              <p className="text-[10px] text-green-500 dark:text-green-500">
                {lang === 'tr' ? 'Hesabınıza giriş yapın' : 'Sign in to your account'}
              </p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}