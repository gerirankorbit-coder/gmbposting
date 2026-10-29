import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      className={cn('flex shrink-0 items-center gap-2 rounded-full', className)}
      aria-label="OrbitPost by Rank Orbit, go to dashboard"
    >
      {compact ? (
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
      ) : (
        <img src="/logo.png" alt="Rank Orbit" className="h-5 w-auto sm:h-6 2xl:h-7" />
      )}
    </Link>
  );
}
