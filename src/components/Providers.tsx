'use client';

import { useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Initialize auth listener (Firebase onAuthStateChanged)
    useAuthStore.getState().initialize();

    // Load language
    const savedLang = localStorage.getItem('language') as 'tr' | 'en' | null;
    if (savedLang) {
      useSettingsStore.getState().setLanguage(savedLang);
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {mounted && <Toaster position="top-right" />}
      {children}
    </ThemeProvider>
  );
}