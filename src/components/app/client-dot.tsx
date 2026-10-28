import type { ClientRef } from '../../../shared/types';
import { cn } from '@/lib/utils';

/** Client colour dot + name. Long names are truncated with an ellipsis; the full name is in the tooltip. */
export function ClientDot({ client, className }: { client: ClientRef | null; className?: string }) {
  if (!client) return <span className={cn('text-orbit-muted', className)}>Unassigned</span>;
  return (
    <span
      title={client.name}
      className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold text-orbit-heading', className)}
    >
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} />
      <span className="min-w-0 truncate">{client.name}</span>
    </span>
  );
}
