import { create } from 'zustand';
import type { Toast } from '../components/ui/Toast';

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type'], duration?: number, action?: Toast['action']) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number, action?: Toast['action']) => void;
  error: (message: string, duration?: number, action?: Toast['action']) => void;
  info: (message: string, duration?: number, action?: Toast['action']) => void;
  warning: (message: string, duration?: number, action?: Toast['action']) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, type = 'info', duration, action) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration, action }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  success: (message, duration, action) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type: 'success', duration, action }],
    }));
  },
  error: (message, duration, action) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type: 'error', duration, action }],
    }));
  },
  info: (message, duration, action) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type: 'info', duration, action }],
    }));
  },
  warning: (message, duration, action) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type: 'warning', duration, action }],
    }));
  },
}));
