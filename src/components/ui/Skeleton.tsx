import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton = ({ className, variant = 'rectangular' }: SkeletonProps) => {
  return (
    <div
      className={clsx(
        'animate-pulse bg-neutral-200 bg-border-default',
        {
          'rounded': variant === 'rectangular',
          'rounded-full': variant === 'circular',
          'rounded-md': variant === 'text',
        },
        className
      )}
    />
  );
};

export const SkeletonCard = () => {
  return (
    <div className="p-4 border border-border-subtle border-border-default rounded-lg">
      <Skeleton className="h-6 w-3/4 mb-2" variant="text" />
      <Skeleton className="h-4 w-full mb-2" variant="text" />
      <Skeleton className="h-4 w-2/3" variant="text" />
    </div>
  );
};

export const SkeletonList = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};
