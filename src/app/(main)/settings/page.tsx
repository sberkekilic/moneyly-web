// src/app/(main)/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import {
  Moon, Sun, Globe, Palette, Database, Trash2,
  Download, Shield, User, LogOut, Key, Bell,
  Monitor, Smartphone, ArrowLeft, Upload, HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useSettingsStore();
  const { user, profile, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted ? theme === 'dark' : false;
  const lang = language || 'tr';

  const t = {
    title:       lang === 'tr' ? 'Ayarlar' : 'Settings',
    appearance:  lang === 'tr' ? 'Görünüm' : 'Appearance',
    theme:       lang === 'tr' ? 'Tema' : 'Theme',
    darkMode:    lang === 'tr' ? 'Karanlık Mod' : 'Dark Mode',
    lightMode:   lang === 'tr' ? 'Aydınlık Mod' : 'Light Mode',
    themeSub:    lang === 'tr' ? 'Uygulama temasını değiştirin' : 'Change app theme',
    language:    lang === 'tr' ? 'Dil' : 'Language',
    langSub:     lang === 'tr' ? 'Uygulama dilini değiştirin' : 'Change app language',
    account:     lang === 'tr' ? 'Hesap' : 'Account',
    profile:     lang === 'tr' ? 'Profil' : 'Profile',
    profileSub:  lang === 'tr' ? 'Hesap bilgileriniz' : 'Your account info',
    logoutBtn:   lang === 'tr' ? 'Çıkış Yap' : 'Log Out',
    logoutSub:   lang === 'tr' ? 'Hesabınızdan çıkış yapın' : 'Sign out of your account',
    logoutConf:  lang === 'tr' ? 'Çıkış yapmak istediğinize emin misiniz?' : 'Are you sure you want to log out?',
    data:        lang === 'tr' ? 'Veri Yönetimi' : 'Data Management',
    exportData:  lang === 'tr' ? 'Verileri Dışa Aktar' : 'Export Data',
    exportSub:   lang === 'tr' ? 'Tüm verilerinizi JSON olarak indirin' : 'Download all data as JSON',
    exportBtn:   lang === 'tr' ? 'İndir' : 'Export',
    importData:  lang === 'tr' ? 'Verileri İçe Aktar' : 'Import Data',
    importSub:   lang === 'tr' ? 'JSON yedekten geri yükle' : 'Restore from JSON backup',
    importBtn:   lang === 'tr' ? 'Yükle' : 'Import',
    storage:     lang === 'tr' ? 'Yerel Depolama' : 'Local Storage',
    storageSub:  lang === 'tr' ? 'Tarayıcıda kullanılan alan' : 'Storage used in browser',
    clearData:   lang === 'tr' ? 'Verileri Temizle' : 'Clear All Data',
    clearSub:    lang === 'tr' ? 'Tüm yerel verileri sil (geri alınamaz!)' : 'Delete all local data (cannot undo!)',
    clearBtn:    lang === 'tr' ? 'Temizle' : 'Clear',
    about:       lang === 'tr' ? 'Hakkında' : 'About',
    version:     lang === 'tr' ? 'Sürüm' : 'Version',
    platform:    lang === 'tr' ? 'Platform' : 'Platform',
    notif:       lang === 'tr' ? 'Bildirimler' : 'Notifications',
    notifSub:    lang === 'tr' ? 'Yakında' : 'Coming soon',
  };

  // Calculate local storage usage
  const storageUsed = (() => {
    if (typeof window === 'undefined') return '0 KB';
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) total += (localStorage.getItem(key)?.length ?? 0) * 2; // UTF-16
    }
    if (total < 1024) return `${total} B`;
    if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
    return `${(total / (1024 * 1024)).toFixed(2)} MB`;
  })();

  const handleExportData = () => {
    try {
      const allData: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try { allData[key] = JSON.parse(localStorage.getItem(key) || ''); }
          catch { allData[key] = localStorage.getItem(key); }
        }
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moneyly-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(lang === 'tr' ? 'Veriler indirildi' : 'Data exported');
    } catch {
      toast.error(lang === 'tr' ? 'Hata oluştu' : 'Error occurred');
    }
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
        toast.success(lang === 'tr' ? 'Veriler yüklendi! Sayfa yenileniyor...' : 'Data imported! Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        toast.error(lang === 'tr' ? 'Dosya okunamadı' : 'Failed to read file');
      }
    };
    input.click();
  };

  const handleClearData = () => {
    const msg = lang === 'tr'
      ? 'Tüm verileriniz silinecek. Bu işlem geri alınamaz!\n\nDevam?'
      : 'All data will be deleted. Cannot be undone!\n\nContinue?';
    if (confirm(msg)) {
      localStorage.clear();
      toast.success(lang === 'tr' ? 'Veriler silindi' : 'Data cleared');
      window.location.href = '/login';
    }
  };

  const handleLogout = async () => {
    if (confirm(t.logoutConf)) {
      await logout();
      window.location.href = '/login';
    }
  };

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || (lang === 'tr' ? 'Kullanıcı' : 'User');
  const email = profile?.email || user?.email || '';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <AuthGuard>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link href="/home" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
        </div>

        {/* ── Desktop: Two column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-6">

            {/* Profile Card */}
            {user && (
              <Section title={t.account} icon={<User size={16} />}>
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{email}</p>
                      <p className="text-xs text-green-500 mt-0.5">
                        {lang === 'tr' ? 'Ücretsiz Plan' : 'Free Plan'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 dark:border-red-800 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut size={14} />
                    {t.logoutBtn}
                  </button>
                </div>
              </Section>
            )}

            {/* Appearance */}
            <Section title={t.appearance} icon={<Palette size={16} />}>
              {/* Theme */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {mounted ? (
                      isDark ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-yellow-500" />
                    ) : (
                      <div className="w-[18px] h-[18px]" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t.theme}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t.themeSub}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className={cn(
                      'w-12 h-6 rounded-full transition-colors relative',
                      isDark ? 'bg-green-600' : 'bg-gray-300'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all',
                      isDark ? 'left-[26px]' : 'left-0.5'
                    )} />
                  </button>
                </div>

                {/* Theme Preview Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all text-center',
                      !isDark
                        ? 'border-green-500 bg-white shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    )}
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Sun size={16} className="text-yellow-500" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.lightMode}</p>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all text-center',
                      isDark
                        ? 'border-green-500 bg-gray-800 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    )}
                  >
                    <div className="w-8 h-8 bg-gray-700 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <Moon size={16} className="text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.darkMode}</p>
                  </button>
                </div>
              </div>

              {/* Language */}
              <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <Globe size={18} className="text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t.language}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.langSub}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLanguage('tr')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
                      language === 'tr'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    🇹🇷 Türkçe
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
                      language === 'en'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    🇬🇧 English
                  </button>
                </div>
              </div>
            </Section>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="space-y-6">

            {/* Data Management */}
            <Section title={t.data} icon={<Database size={16} />}>
              {/* Storage Info */}
              <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <HardDrive size={18} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t.storage}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t.storageSub}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold">
                    {mounted ? storageUsed : '...'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: '15%' }} />
                </div>
              </div>

              {/* Export & Import */}
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                  >
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                      <Download size={18} className="text-blue-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.exportData}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{t.exportSub}</p>
                    </div>
                  </button>

                  <button
                    onClick={handleImportData}
                    className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-green-300 dark:hover:border-green-700 transition-all group"
                  >
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl group-hover:bg-green-100 dark:group-hover:bg-green-900/30 transition-colors">
                      <Upload size={18} className="text-green-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.importData}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{t.importSub}</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-5 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleClearData}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
                >
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <Trash2 size={18} className="text-red-500" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">{t.clearData}</p>
                    <p className="text-[10px] text-red-400">{t.clearSub}</p>
                  </div>
                </button>
              </div>
            </Section>

            {/* Notifications (placeholder) */}
            <Section title={t.notif} icon={<Bell size={16} />}>
              <div className="p-5 flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                  <Bell size={18} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t.notif}</p>
                  <p className="text-xs text-gray-400">{t.notifSub}</p>
                </div>
                <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 rounded-lg text-[10px] font-semibold">
                  {lang === 'tr' ? 'Yakında' : 'Soon'}
                </span>
              </div>
            </Section>

            {/* About */}
            <Section title={t.about} icon={<Shield size={16} />}>
              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center">
                    <span className="text-white font-bold text-lg">M</span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900 dark:text-white">Moneyly</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {lang === 'tr' ? 'Kişisel Finans Takipçisi' : 'Personal Finance Tracker'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <InfoMini
                    label={t.version}
                    value="1.0.0"
                    icon={<Shield size={12} />}
                  />
                  <InfoMini
                    label={t.platform}
                    value="Web (Next.js)"
                    icon={<Monitor size={12} />}
                  />
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

// ══════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ══════════════════════════════════════════════════════════

function Section({ title, icon, children }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-gray-400 dark:text-gray-500">{icon}</span>
        <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {title}
        </h2>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoMini({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-gray-400">{icon}</span>
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}