import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';

const REFRESH_TOKEN_STORAGE_KEY = 'sothis.refreshToken';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isInitializing: boolean;
  setSession: (params: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setInitializing: (value: boolean) => void;
}

/**
 * Access token lives in memory only (never localStorage) so it disappears
 * on a full page reload/tab close; the refresh token is persisted so a
 * reload can silently re-authenticate via POST /auth/refresh instead of
 * forcing the user to log in again. The backend still owns the real
 * authorization decisions on every request — this store only carries the
 * UI's copy of "who am I", never anything the frontend uses to decide what
 * the user is allowed to see server-side.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
  user: null,
  isInitializing: true,

  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    set({ accessToken, refreshToken, user, isInitializing: false });
  },

  setAccessToken: (accessToken) => set({ accessToken }),

  clearSession: () => {
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    set({ accessToken: null, refreshToken: null, user: null, isInitializing: false });
  },

  setInitializing: (value) => set({ isInitializing: value }),
}));
