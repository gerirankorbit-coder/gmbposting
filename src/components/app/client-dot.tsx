import type { ClientRef } from '../../../shared/types';
import { cn } from '@/lib/utils';

/**
 * Client colour dot + name. Long names wrap onto the next line; pass `truncate` for one-line
 * contexts (the full name stays in the tooltip).
 */
export function ClientDot({
  client,
  className,
  truncate = false,
}: {
  client: ClientRef | null;
  className?: string;
  truncate?: boolean;
}) {
  if (!client) return <span className={cn('text-orbit-muted', className)}>Unassigned</span>;
  return (
    <span
      title={client.name}
      className={cn(
        'inline-flex min-w-0 max-w-full gap-1.5 font-semibold text-orbit-heading',
        truncate ? 'items-center' : 'items-start',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('h-2.5 w-2.5 shrink-0 rounded-full', !truncate && 'mt-[0.3em]')}
        style={{ backgroundColor: client.color }}
      />
      <span className={cn('min-w-0', truncate ? 'truncate' : 'break-words [overflow-wrap:anywhere]')}>{client.name}</span>
    </span>
  );
}
