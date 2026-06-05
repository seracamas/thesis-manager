import { useState } from 'react';
import { Button } from '../ui/Button';
import { hasApiKey } from '../../utils/anthropic';
import clsx from 'clsx';

interface AIButtonProps {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AIButton = ({
  onClick,
  disabled,
  children,
  variant = 'primary',
  size = 'md',
  className,
}: AIButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const hasKey = hasApiKey();

  const handleClick = async () => {
    if (!hasKey) {
      return;
    }
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasKey) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={clsx('relative', className)}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
      <span className="ml-1 text-xs opacity-70">✨</span>
    </Button>
  );
};
