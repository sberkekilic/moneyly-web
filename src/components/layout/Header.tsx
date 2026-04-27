// src/components/layout/Header.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell, Settings, X, Check, Trash2,
  CreditCard, TrendingUp, TrendingDown, Calendar,
  AlertTriangle, CheckCircle, Clock, RefreshCw
} from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { useTransactionStore } from '@/store/transactionStore';
import { useIncomeStore } from '@/store/incomeStore';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────

interface Notification {
  id: string;
  type: 'debt_warning' | 'debt_urgent' | 'debt_overdue' | 'income_reminder' | 'budget_alert' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  icon: React.ReactNode;
  color: string;
  action?: { label: string; href: string };
}

// ── Page Titles ───────────────────────────────────────────

const PAGE_TITLES: Record<string, Record<string, string>> = {
  '/home':       { tr: 'Anasayfa',   en: 'Home' },
  '/income':     { tr: 'Gelirler',   en: 'Income' },
  '/outcome':    { tr: 'Giderler',   en: 'Expenses' },
  '/investment': { tr: 'Yatırımlar', en: 'Investments' },
  '/account':    { tr: 'Hesaplar',   en: 'Accounts' },
  '/settings':   { tr: 'Ayarlar',    en: 'Settings' },
};

// ── Main Component ────────────────────────────────────────

export function Header() {
  const pathname = usePathname();
  const language = useSettingsStore((s) => s.language);
  const { bankDataList } = useTransactionStore();
  const { incomes } = useIncomeStore();
  const lang = language || 'tr';

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const titleObj = PAGE_TITLES[pathname];
  const title = titleObj ? titleObj[lang] : 'Moneyly';

  const t = {
    notifications: lang === 'tr' ? 'Bildirimler' : 'Notifications',
    noNotif:       lang === 'tr' ? 'Bildirim yok' : 'No notifications',
    noNotifSub:    lang === 'tr' ? 'Her şey yolunda görünüyor!' : 'Everything looks good!',
    markAllRead:   lang === 'tr' ? 'Tümünü okundu işaretle' : 'Mark all as read',
    clearAll:      lang === 'tr' ? 'Tümünü temizle' : 'Clear all',
    viewAll:       lang === 'tr' ? 'Tümünü gör' : 'View all',
    daysLeft:      lang === 'tr' ? 'gün kaldı' : 'days left',
    today:         lang === 'tr' ? 'Bugün!' : 'Today!',
    overdue:       lang === 'tr' ? 'gün geçti' : 'days overdue',
    justNow:       lang === 'tr' ? 'Az önce' : 'Just now',
    minutesAgo:    lang === 'tr' ? 'dk önce' : 'min ago',
    hoursAgo:      lang === 'tr' ? 'sa önce' : 'hr ago',
  };

  // ── Generate notifications from data ──
  useEffect(() => {
    const newNotifs: Notification[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Load dismissed IDs from localStorage
    try {
      const saved = localStorage.getItem('dismissedNotifications');
      if (saved) setDismissedIds(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }

    // ── Credit Card Notifications ──
    bankDataList.forEach((bank: any) => {
      (bank.accounts ?? []).forEach((acc: any) => {
        if (acc.isDebit !== false) return;

        const cutoffDay = acc.cutoffDate || 1;
        const debt = acc.totalDebt ?? 0;
        if (debt <= 0) return;

        // Calculate dates
        let nextCutoff = new Date(now.getFullYear(), now.getMonth(), cutoffDay);
        if (now.getDate() >= cutoffDay) {
          nextCutoff = new Date(now.getFullYear(), now.getMonth() + 1, cutoffDay);
        }
        const nextDue = new Date(nextCutoff);
        nextDue.setDate(nextDue.getDate() + 10);

        const daysToCutoff = Math.ceil((nextCutoff.getTime() - todayStart.getTime()) / 86400000);
        const daysToDue = Math.ceil((nextDue.getTime() - todayStart.getTime()) / 86400000);

        const cardName = `${bank.bankName} ${acc.name}`;
        const minPayment = acc.minPayment ?? 0;

        // OVERDUE
        if (daysToDue < 0) {
          newNotifs.push({
            id: `overdue_${acc.accountId}`,
            type: 'debt_overdue',
            title: lang === 'tr' ? '⚠️ GECİKMİŞ ÖDEME!' : '⚠️ OVERDUE PAYMENT!',
            message: lang === 'tr'
              ? `${cardName} - ${formatAmount(debt)}₺ borç son ödeme tarihini ${Math.abs(daysToDue)} gün geçti!`
              : `${cardName} - ${formatAmount(debt)}₺ debt is ${Math.abs(daysToDue)} days overdue!`,
            timestamp: now,
            read: false,
            icon: <AlertTriangle size={16} />,
            color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
            action: { label: lang === 'tr' ? 'Hesaba Git' : 'Go to Account', href: '/account' },
          });
        }
        // DUE TODAY
        else if (daysToDue === 0) {
          newNotifs.push({
            id: `due_today_${acc.accountId}`,
            type: 'debt_urgent',
            title: lang === 'tr' ? '🔴 BUGÜN SON GÜN!' : '🔴 DUE TODAY!',
            message: lang === 'tr'
              ? `${cardName} - ${formatAmount(minPayment)}₺ asgari ödeme bugün yapılmalı!`
              : `${cardName} - ${formatAmount(minPayment)}₺ minimum payment is due today!`,
            timestamp: now,
            read: false,
            icon: <CreditCard size={16} />,
            color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
            action: { label: lang === 'tr' ? 'Hesaba Git' : 'Go to Account', href: '/account' },
          });
        }
        // PAY PERIOD (between cutoff and due)
        else if (daysToCutoff <= 0 && daysToDue > 0) {
          newNotifs.push({
            id: `pay_period_${acc.accountId}`,
            type: 'debt_warning',
            title: lang === 'tr' ? '🟠 Ödeme Dönemi' : '🟠 Payment Period',
            message: lang === 'tr'
              ? `${cardName} - ${formatAmount(minPayment)}₺ asgari ödeme için ${daysToDue} ${t.daysLeft}`
              : `${cardName} - ${formatAmount(minPayment)}₺ min. payment due in ${daysToDue} ${t.daysLeft}`,
            timestamp: now,
            read: false,
            icon: <Clock size={16} />,
            color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
            action: { label: lang === 'tr' ? 'Detaylar' : 'Details', href: '/home' },
          });
        }
        // APPROACHING (within 7 days of cutoff)
        else if (daysToCutoff <= 7 && daysToCutoff > 0) {
          newNotifs.push({
            id: `approaching_${acc.accountId}`,
            type: 'debt_warning',
            title: lang === 'tr' ? '🟡 Hesap Kesimi Yaklaşıyor' : '🟡 Cutoff Approaching',
            message: lang === 'tr'
              ? `${cardName} - Hesap kesim tarihi ${daysToCutoff} gün sonra. Borç: ${formatAmount(debt)}₺`
              : `${cardName} - Cutoff in ${daysToCutoff} days. Debt: ${formatAmount(debt)}₺`,
            timestamp: now,
            read: false,
            icon: <Calendar size={16} />,
            color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
          });
        }
      });
    });

    // ── Recurring Income Reminders ──
    incomes.forEach((income: any) => {
      if (!income.isRecurring || !income.day) return;

      const incomeDay = income.day;
      const todayDay = now.getDate();
      const daysUntil = incomeDay >= todayDay
        ? incomeDay - todayDay
        : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - todayDay + incomeDay;

      if (daysUntil <= 3 && daysUntil >= 0) {
        newNotifs.push({
          id: `income_${income.incomeId}_${now.getMonth()}`,
          type: 'income_reminder',
          title: lang === 'tr' ? '💰 Gelir Hatırlatma' : '💰 Income Reminder',
          message: lang === 'tr'
            ? `${income.source} geliri (${formatAmount(income.amount)}₺) ${daysUntil === 0 ? 'bugün' : `${daysUntil} gün sonra`}`
            : `${income.source} income (${formatAmount(income.amount)}₺) ${daysUntil === 0 ? 'today' : `in ${daysUntil} days`}`,
          timestamp: now,
          read: false,
          icon: <TrendingUp size={16} />,
          color: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        });
      }
    });

    // Filter out dismissed
    const filtered = newNotifs.filter(n => !dismissedIds.has(n.id));

    // Sort: urgent first
    const typeOrder: Record<string, number> = {
      debt_overdue: 0, debt_urgent: 1, debt_warning: 2, income_reminder: 3, budget_alert: 4, info: 5,
    };
    filtered.sort((a, b) => (typeOrder[a.type] ?? 5) - (typeOrder[b.type] ?? 5));

    setNotifications(filtered);
  }, [bankDataList, incomes, lang, dismissedIds]);

  // ── Close panel on outside click ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const dismissNotification = (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissedNotifications', JSON.stringify([...newDismissed]));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    const allIds = new Set(dismissedIds);
    notifications.forEach(n => allIds.add(n.id));
    setDismissedIds(allIds);
    localStorage.setItem('dismissedNotifications', JSON.stringify([...allIds]));
    setNotifications([]);
    setShowNotifications(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 lg:px-8 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h1>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 relative" ref={panelRef}>
          {/* Notification Bell */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              'relative p-2 rounded-xl transition-colors',
              showNotifications
                ? 'bg-gray-100 dark:bg-gray-800'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Bell size={18} className={cn(
              unreadCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            )} />

            {/* Badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
                <span className="absolute inline-flex h-4 w-4 rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </span>
            )}
          </button>

          {/* Settings (mobile only) */}
          <Link
            href="/settings"
            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings size={18} className="text-gray-500 dark:text-gray-400" />
          </Link>

          {/* ── Notification Panel ── */}
          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden z-50">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-gray-500" />
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{t.notifications}</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 text-[10px] font-bold rounded-md">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <>
                      <button
                        onClick={markAllRead}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-colors"
                        title={t.markAllRead}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={clearAll}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors"
                        title={t.clearAll}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-10 px-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-3">
                      <CheckCircle size={24} className="text-green-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.noNotif}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.noNotifSub}</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <NotificationItem
                      key={notif.id}
                      notification={notif}
                      onDismiss={() => dismissNotification(notif.id)}
                      onClose={() => setShowNotifications(false)}
                      t={t}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Notification Item ─────────────────────────────────────

function NotificationItem({
  notification,
  onDismiss,
  onClose,
  t,
}: {
  notification: Notification;
  onDismiss: () => void;
  onClose: () => void;
  t: any;
}) {
  const colorParts = notification.color.split(' ');
  const textColor = colorParts[0];
  const bgColor = colorParts.slice(1).join(' ');

  return (
    <div className={cn(
      'flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group',
      !notification.read && 'bg-blue-50/30 dark:bg-blue-900/5'
    )}>
      {/* Icon */}
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', bgColor)}>
        <span className={textColor}>{notification.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
          {notification.title}
        </p>
        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">
          {notification.message}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          {/* Action Button */}
          {notification.action && (
            <Link
              href={notification.action.href}
              onClick={onClose}
              className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors', textColor, bgColor, 'hover:opacity-80')}
            >
              {notification.action.label}
            </Link>
          )}

          {/* Unread dot */}
          {!notification.read && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 self-start mt-0.5"
      >
        <X size={12} />
      </button>
    </div>
  );
}