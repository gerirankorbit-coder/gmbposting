import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-orbit-gradient text-white',
        violet: 'border-violet-200 bg-violet-50 text-violet-700',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        amber: 'border-amber-200 bg-amber-50 text-amber-700',
        rose: 'border-rose-200 bg-rose-50 text-rose-700',
        slate: 'border-slate-200 bg-slate-50 text-slate-700',
        gray: 'border-gray-200 bg-gray-100 text-gray-500',
        outline: 'border-orbit-line bg-white text-orbit-body',
      },
    },
    defaultVariants: { variant: 'violet' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
