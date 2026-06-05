import { HTMLAttributes } from 'react';
import clsx from 'clsx';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'priority-high' | 'priority-medium' | 'priority-low';
  color?: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

export const Tag = ({
  children,
  variant = 'default',
  color,
  size = 'sm',
  onRemove,
  className,
  ...props
}: TagProps) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-chip font-medium',
        {
          'badge-default': variant === 'default',
          'badge-accent': variant === 'accent',
          'badge-priority-high': variant === 'priority-high',
          'badge-priority-medium': variant === 'priority-medium',
          'badge-priority-low': variant === 'priority-low',
          'px-2.5 py-1 text-label': size === 'sm',
          'px-3 py-1.5 text-muted': size === 'md',
        },
        className
      )}
      style={color ? { 
        backgroundColor: `${color}15`,
        color: color,
      } : undefined}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:opacity-70 transition-opacity"
          aria-label="Remove tag"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
};
