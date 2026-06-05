import { HTMLAttributes } from 'react';
import clsx from 'clsx';
import { Icons } from '../../config/icons';

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'active';
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export const StatusBadge = ({ status, size = 'sm', showIcon = false, className, ...props }: StatusBadgeProps) => {
  const Icon = status === 'completed' ? Icons.success : status === 'pending' ? Icons.clock : Icons.info;
  
  const styles = {
    pending: 'bg-bg-input text-text-muted',
    scheduled: 'bg-[#E8F2F8] text-info',
    completed: 'bg-[#F0FAF4] text-success',
    cancelled: 'bg-bg-input text-text-muted',
    active: 'bg-[#E8F2F8] text-info',
  };

  return (
    <span
      className={clsx(
        'priority-pill',
        styles[status],
        {
          'text-[11px] px-2.5 py-1': size === 'sm',
          'text-xs px-3 py-1.5': size === 'md',
        },
        className
      )}
      {...props}
    >
      {showIcon && <Icon size={12} className="inline mr-1" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};
