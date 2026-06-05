import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  setPassword: (newPassword: string) => void;
  checkPassword: (password: string) => boolean;
}

// Default password - user should change this
const DEFAULT_PASSWORD = 'thesis2024';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      login: (password: string) => {
        const storedPassword = localStorage.getItem('app-password') || DEFAULT_PASSWORD;
        if (password === storedPassword) {
          set({ isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => {
        set({ isAuthenticated: false });
      },
      setPassword: (newPassword: string) => {
        localStorage.setItem('app-password', newPassword);
      },
      checkPassword: (password: string) => {
        const storedPassword = localStorage.getItem('app-password') || DEFAULT_PASSWORD;
        return password === storedPassword;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    }
  )
);
