import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-xl bg-orbit-primary/10', className)}
      {...props}
    />
  );
}

export { Skeleton };
