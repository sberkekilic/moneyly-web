// src/models/user.ts
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  currency?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}