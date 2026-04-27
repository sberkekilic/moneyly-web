// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { AuthInitializer } from '@/components/AuthInitializer';

export const metadata: Metadata = {
  title: 'Moneyly',
  description: 'Personal Finance Tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Providers>
          <AuthInitializer />
          {children}
        </Providers>
      </body>
    </html>
  );
}