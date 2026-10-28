import type { ClientRef } from '../../../shared/types';
import { cn } from '@/lib/utils';

export function ClientDot({ client, className }: { client: ClientRef | null; className?: string }) {
  if (!client) return <span className={cn('text-orbit-muted', className)}>Unassigned</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold text-orbit-heading', className)}>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: client.color }} />
      <span className="truncate">{client.name}</span>
    </span>
  );
}
