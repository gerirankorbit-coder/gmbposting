import type { StockState } from '../../../shared/types';
import { cn } from '@/lib/utils';

const TONE: Record<StockState, string> = {
  ok: 'bg-emerald-500',
  low: 'bg-amber-500',
  empty: 'bg-rose-500',
};

export function StockBar({ unused, total, state, className }: { unused: number; total: number; state: StockState; className?: string }) {
  const pct = total ? Math.max(state === 'empty' ? 0 : 4, (unused / total) * 100) : 0;
  return (
    <div
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-orbit-primary/10', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={unused}
      aria-label={`${unused} of ${total} images unused`}
    >
      <div className={cn('h-full rounded-full transition-all', TONE[state])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const STOCK_LABEL: Record<StockState, string> = { ok: 'Healthy', low: 'Running low', empty: 'Out of images' };
export const STOCK_BADGE: Record<StockState, 'emerald' | 'amber' | 'rose'> = { ok: 'emerald', low: 'amber', empty: 'rose' };
