import { Skeleton } from '@/components/ui/skeleton';

export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div className="space-y-3">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  );
}
