// src/store/authStore.ts
import { create } from 'zustand';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/models/user';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  register: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUserProfile: (uid: string) => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  error: null,

  initialize: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        set({ user, isLoading: true });
        try {
          await get().loadUserProfile(user.uid);
        } catch {
          // Profile load failed, but user is still authenticated
          set({ isLoading: false });
        }
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });
  },

  loadUserProfile: async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        set({ profile: docSnap.data() as UserProfile, isLoading: false });
      } else {
        // No profile document, but don't block the UI
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Profile load error:', error);
      set({ isLoading: false });
    }
  },

  register: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        displayName,
        currency: 'TRY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), profile);
      set({ user, profile, isLoading: false });
    } catch (error: any) {
      let errorMessage = 'Kayıt başarısız';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Bu email adresi zaten kullanımda';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Geçersiz email adresi';
          break;
        case 'auth/weak-password':
          errorMessage = 'Şifre çok zayıf, en az 6 karakter olmalı';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'İnternet bağlantısı hatası';
          break;
      }
      
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      await get().loadUserProfile(user.uid);
    } catch (error: any) {
      let errorMessage = 'Giriş başarısız';
      
      switch (error.code) {
        case 'auth/invalid-credential':
          errorMessage = 'Email veya şifre hatalı';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Bu email ile kayıtlı kullanıcı bulunamadı';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Geçersiz email adresi';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'İnternet bağlantısı hatası';
          break;
      }
      
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null, profile: null });
  },
}));