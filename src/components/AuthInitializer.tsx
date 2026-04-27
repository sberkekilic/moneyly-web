// src/components/AuthInitializer.tsx
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function AuthInitializer() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    // Initialize Firebase Auth listener
    const unsubscribe = initialize();
    
    // Cleanup function
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [initialize]);

  // This component doesn't render anything
  return null;
}