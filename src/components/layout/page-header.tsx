import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Bubbles, OrbitLine } from './orbit-decor';

interface PageHeaderProps {
  eyebrow?: string;
  /** Title text; wrap the highlighted word with `highlight`. */
  title: string;
  highlight?: string;
  description?: ReactNode;
  actions?: ReactNode;
  bubbles?: boolean;
  className?: string;
}

/**
 * Page title in the Rank Orbit style: eyebrow pill, extra-bold heading with one gradient
 * word, and a gradient full stop.
 */
export function PageHeader({
  eyebrow,
  title,
  highlight,
  description,
  actions,
  bubbles = false,
  className,
}: PageHeaderProps) {
  let content: ReactNode = title;
  if (highlight && title.includes(highlight)) {
    const [before, ...rest] = title.split(highlight);
    content = (
      <>
        {before}
        <span className="text-gradient">{highlight}</span>
        {rest.join(highlight)}
      </>
    );
  }
  return (
    <header className={cn('relative isolate mb-8 pt-4', className)}>
      <OrbitLine className="-left-10 -top-6 -z-10 h-40 w-[110%] max-w-none opacity-80" />
      {bubbles && <Bubbles className="-z-10" count={4} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <span className="eyebrow mb-3">{eyebrow}</span>}
          <h1 className="text-3xl leading-[1.08] sm:text-4xl">
            {content}
            <span className="text-gradient">.</span>
          </h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-orbit-muted sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
