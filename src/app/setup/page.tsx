// ============================================
// SETUP / ONBOARDING PAGE
// Replaces: AddIncome screen ('/' route)
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { storage, KEYS } from '@/services/storage';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const handleComplete = () => {
    storage.set(KEYS.SELECTED_OPTION, 'completed');
    router.push('/home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-950 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-green-600">Moneyly</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Kişisel finans takipçiniz
          </p>
        </div>

        {/* Onboarding steps will go here */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Kuruluma Başlayın</h2>
          <p className="text-sm text-gray-500">
            Gelir bilgilerinizi girerek başlayın
          </p>
          <button
            onClick={handleComplete}
            className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-2xl transition-colors"
          >
            Başla
          </button>
        </div>
      </div>
    </div>
  );
}