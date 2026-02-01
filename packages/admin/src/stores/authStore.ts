import { create } from 'zustand';
import { adminApi } from '../services/adminApi';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const TOKEN_KEY = 'kiosk_admin_token';
const USER_KEY = 'kiosk_admin_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await adminApi.login(email, password);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({
        isAuthenticated: true,
        isLoading: false,
        user,
        token,
        error: null,
      });
    } catch (err: any) {
      set({
        isAuthenticated: false,
        isLoading: false,
        error: err.message || 'Login failed',
      });
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
      error: null,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);

    if (!token || !userRaw) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const user = JSON.parse(userRaw);
      // Quick validation — try fetching stats to verify token is still valid
      await adminApi.getStats(token);
      set({ isAuthenticated: true, isLoading: false, user, token });
    } catch {
      // Token expired or invalid
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ isAuthenticated: false, isLoading: false, user: null, token: null });
    }
  },
}));
