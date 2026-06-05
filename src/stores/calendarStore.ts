import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CalendarState {
  accessToken: string | null;
  userEmail: string | null;
  setAccessToken: (token: string, email: string) => void;
  clearAccessToken: () => void;
  isConnected: () => boolean;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      userEmail: null,
      setAccessToken: (token: string, email: string) => {
        set({ accessToken: token, userEmail: email });
      },
      clearAccessToken: () => {
        set({ accessToken: null, userEmail: null });
      },
      isConnected: () => {
        return !!get().accessToken;
      },
    }),
    {
      name: 'calendar-storage',
    }
  )
);
