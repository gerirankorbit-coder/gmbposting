import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full rounded-xl border border-orbit-line bg-white px-3.5 py-2.5 text-sm text-orbit-heading shadow-sm transition placeholder:text-orbit-muted/70 focus-visible:border-orbit-primary/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orbit-primary/15 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-rose-400',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
