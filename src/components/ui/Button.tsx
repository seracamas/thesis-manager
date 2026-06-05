import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-input font-semibold transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-accent/15',
          'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
          {
            'btn-primary': variant === 'primary',
            'btn-secondary': variant === 'secondary',
            'btn-danger': variant === 'danger',
            'btn-ghost': variant === 'ghost',
            'px-3 py-1.5 text-[11px]': size === 'sm',
            'px-5 py-2.5 text-button': size === 'md',
            'px-6 py-3 text-body': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
