import { HTMLAttributes } from 'react';
import clsx from 'clsx';

interface PriorityPillProps extends HTMLAttributes<HTMLSpanElement> {
  priority: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md';
}

export const PriorityPill = ({ priority, size = 'sm', className, ...props }: PriorityPillProps) => {
  return (
    <span
      className={clsx(
        'priority-pill',
        `priority-${priority}`,
        {
          'text-[11px] px-2.5 py-1': size === 'sm',
          'text-xs px-3 py-1.5': size === 'md',
        },
        className
      )}
      {...props}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
};
