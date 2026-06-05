import { useEffect } from 'react';
import clsx from 'clsx';
import { Icons } from '../../config/icons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export const ToastComponent = ({ toast, onClose }: ToastProps) => {
  useEffect(() => {
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const borderColor = {
    success: '#5A9E76',
    error: '#C05454',
    info: '#E8C96A',
    warning: '#E8C96A',
  }[toast.type];

  const iconColor = {
    success: '#5A9E76',
    error: '#C05454',
    info: '#E8C96A',
    warning: '#E8C96A',
  }[toast.type];

  const Icon = {
    success: Icons.success,
    error: Icons.error,
    info: Icons.info,
    warning: Icons.info,
  }[toast.type];

  return (
    <div
      className="toast-base flex items-start gap-3 animate-in slide-in-from-top-5"
      style={{ borderLeftColor: borderColor }}
      role="alert"
    >
      <div className="flex-shrink-0" style={{ color: iconColor }}>
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <p className="text-secondary font-medium text-text-primary">
          {toast.message}
          {toast.action && (
            <>
              {' '}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toast.action!.onClick();
                  onClose(toast.id);
                }}
                className="underline font-semibold hover:opacity-80 transition-opacity"
                style={{ color: '#E8C96A' }}
              >
                {toast.action.label}
              </button>
            </>
          )}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="btn-ghost flex-shrink-0"
        aria-label="Close notification"
      >
        <Icons.close size={16} />
      </button>
    </div>
  );
};
