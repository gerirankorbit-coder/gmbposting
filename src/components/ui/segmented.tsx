import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  description?: string;
}

/** Pill-style single-choice control with radio-group semantics. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = 'default',
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  className?: string;
  size?: 'default' | 'sm';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex flex-wrap gap-1 rounded-full border border-orbit-line bg-white/70 p-1', className)}
      onKeyDown={(e) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const i = options.findIndex((o) => o.value === value);
        const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const next = options[(i + delta + options.length) % options.length]!;
        onChange(next.value);
        (e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              active ? 'bg-orbit-gradient text-white shadow-glow' : 'text-orbit-body hover:bg-orbit-primary/10 hover:text-orbit-primary',
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
