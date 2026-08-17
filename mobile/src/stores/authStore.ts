// src/stores/authStore.ts
// Zustand store for authentication state.
// Tokens are stored in expo-secure-store (encrypted), NOT in Zustand.
// Zustand only holds the deserialized user profile for reactive UI updates.

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'GUEST' | 'HOST' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  /** Register a new user and store tokens. */
  register: (email: string, password: string, displayName: string) => Promise<void>;

  /** Log in with email/password and store tokens. */
  login: (email: string, password: string) => Promise<void>;

  /** Log out: revoke tokens on server, clear local state. */
  logout: () => Promise<void>;

  /** Try to restore session from stored tokens on app launch. */
  restoreSession: () => Promise<void>;

  /** Set loading state. */
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  register: async (email, password, displayName) => {
    const { data } = await api.post('/api/auth/register', {
      email,
      password,
      displayName,
    });

    const { user, accessToken, refreshToken } = data.data;

    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);

    set({ user, isAuthenticated: true });
  },

  login: async (email, password) => {
    const { data } = await api.post('/api/auth/login', {
      email,
      password,
    });

    const { user, accessToken, refreshToken } = data.data;

    await SecureStore.setItemAsync('access_token', accessToken);
    await SecureStore.setItemAsync('refresh_token', refreshToken);

    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch {
      // Best-effort: even if server call fails, clear local state
    }

    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');

    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      // Validate token by fetching user profile
      const { data } = await api.get('/api/auth/me');
      set({ user: data.data, isAuthenticated: true, isLoading: false });
    } catch {
      // Token expired or invalid — silent refresh interceptor may handle it.
      // If that also fails, clear everything.
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
