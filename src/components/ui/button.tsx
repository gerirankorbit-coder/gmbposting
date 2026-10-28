import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-orbit-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-orbit-gradient text-white shadow-glow hover:shadow-glow-strong hover:brightness-95 active:brightness-90',
        secondary:
          'border border-orbit-primary/60 bg-white/60 text-orbit-primary hover:bg-white hover:border-orbit-primary',
        outline:
          'border border-orbit-line bg-white/80 text-orbit-heading hover:border-orbit-primary/40 hover:bg-white',
        ghost: 'text-orbit-body hover:bg-orbit-primary/10 hover:text-orbit-primary',
        destructive: 'bg-rose-500 text-white shadow-sm hover:bg-rose-600',
        link: 'rounded-none text-orbit-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5',
        sm: 'h-8 px-3.5 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

/**
 * Circular icon chip placed at the end of pill buttons (white chip on gradient buttons,
 * gradient chip on secondary buttons), matching the Rank Orbit site.
 */
function ButtonChip({
  children,
  tone = 'light',
  className,
}: {
  children: React.ReactNode;
  tone?: 'light' | 'gradient';
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        '-mr-3 ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full [&_svg]:size-3.5',
        tone === 'light' ? 'bg-white text-orbit-primary' : 'bg-orbit-gradient text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}

export { Button, ButtonChip, buttonVariants };
