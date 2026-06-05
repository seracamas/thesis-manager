import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface AutosaveIndicatorProps {
  isSaving: boolean;
  lastSaved?: Date;
  className?: string;
}

export const AutosaveIndicator = ({
  isSaving,
  lastSaved,
  className,
}: AutosaveIndicatorProps) => {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!isSaving && lastSaved) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, lastSaved]);

  if (!isSaving && !showSaved) {
    return null;
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-2 text-sm',
        {
          'text-text-muted text-text-secondary': isSaving,
          'text-green-600 dark:text-green-400': !isSaving && showSaved,
        },
        className
      )}
    >
      {isSaving ? (
        <>
          <svg
            className="animate-spin h-4 w-4"
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
          <span>Saving...</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>Saved</span>
        </>
      )}
    </div>
  );
};
