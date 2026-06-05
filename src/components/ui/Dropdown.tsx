import { ReactNode, useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

interface DropdownOption {
  label: string;
  value: string;
  icon?: ReactNode;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export const Dropdown = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className,
  label,
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className={clsx('relative', className)}>
      {label && (
        <label className="block text-label uppercase tracking-wider text-text-muted mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'input-base w-full flex items-center justify-between',
          'transition-all duration-150'
        )}
      >
        <span className={clsx(!selectedOption && 'text-text-placeholder')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={clsx(
            'w-5 h-5 transition-transform text-text-secondary',
            isOpen && 'transform rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1.5 bg-bg-card rounded-input shadow-soft-hover max-h-60 overflow-auto" style={{ border: '1px solid #EEEBE4' }}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={clsx(
                'w-full px-4 py-2.5 text-left flex items-center gap-2',
                'hover:bg-bg-hover transition-colors text-body text-text-primary',
                value === option.value && 'bg-accent-soft text-text-primary'
              )}
            >
              {option.icon && <span>{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
