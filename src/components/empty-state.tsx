import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Illustrated empty state: an orbiting icon badge, short copy, and an optional CTA. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="relative mb-6 h-28 w-28">
        <svg aria-hidden viewBox="0 0 112 112" className="absolute inset-0 h-full w-full">
          <ellipse
            cx="56"
            cy="56"
            rx="52"
            ry="22"
            transform="rotate(-24 56 56)"
            fill="none"
            stroke="#C4B5FD"
            strokeWidth="1.2"
            strokeDasharray="3 5"
          />
          <circle cx="101" cy="33" r="4" fill="#D946EF" fillOpacity="0.7" />
          <circle cx="12" cy="80" r="3" fill="#8B2CF5" fillOpacity="0.5" />
        </svg>
        <div className="absolute inset-[22%] flex items-center justify-center rounded-full bg-orbit-gradient text-white shadow-glow">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
      </div>
      <h3 className="text-lg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-orbit-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
