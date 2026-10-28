import { AlertTriangle, CheckCircle2, Clock, Loader2, PenLine, Send, XCircle, Ban } from 'lucide-react';
import type { ConnectionStatus, PostStatus } from '../../../shared/types';
import { Badge, type BadgeProps } from '@/components/ui/badge';

const CONNECTION: Record<ConnectionStatus, { label: string; variant: BadgeProps['variant'] }> = {
  active: { label: 'Active', variant: 'emerald' },
  needs_reauth: { label: 'Needs reconnect', variant: 'amber' },
  revoked: { label: 'Disconnected', variant: 'gray' },
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const s = CONNECTION[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export const POST_STATUS_META: Record<
  PostStatus,
  { label: string; variant: BadgeProps['variant']; icon: typeof Clock }
> = {
  draft: { label: 'Draft', variant: 'slate', icon: PenLine },
  pending_approval: { label: 'Pending', variant: 'amber', icon: Clock },
  scheduled: { label: 'Scheduled', variant: 'violet', icon: Send },
  publishing: { label: 'Publishing', variant: 'violet', icon: Loader2 },
  published: { label: 'Published', variant: 'emerald', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'rose', icon: XCircle },
  cancelled: { label: 'Cancelled', variant: 'gray', icon: Ban },
};

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const m = POST_STATUS_META[status];
  const Icon = m.icon;
  return (
    <Badge variant={m.variant}>
      <Icon className={status === 'publishing' ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} aria-hidden />
      {m.label}
    </Badge>
  );
}

export function WarningBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="amber">
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {children}
    </Badge>
  );
}
