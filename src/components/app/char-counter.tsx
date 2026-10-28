import { POST_SUMMARY_MAX } from '../../../shared/types';
import { cn } from '@/lib/utils';

export function CharCounter({ length, max = POST_SUMMARY_MAX }: { length: number; max?: number }) {
  const ratio = length / max;
  return (
    <span
      aria-live="polite"
      className={cn(
        'text-xs font-semibold tabular-nums',
        length > max ? 'text-rose-600' : ratio > 0.9 ? 'text-amber-600' : 'text-orbit-muted',
      )}
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}
