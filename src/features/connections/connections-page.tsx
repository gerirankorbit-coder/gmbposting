import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  Link2,
  Loader2,
  MoreHorizontal,
  Plug,
  RefreshCw,
  Unplug,
} from 'lucide-react';
import type { ConnectionDTO } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { useConnections } from '@/lib/queries';
import { formatLocal, initials, pluralize, timeAgo } from '@/lib/format';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ConnectionStatusBadge } from '@/components/app/status-badge';
import { ErrorState } from '@/components/app/error-state';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button, ButtonChip } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConnectGoogle, useDisconnect, useSyncConnection } from './use-connection-actions';

export function ConnectionsPage() {
  const isAdmin = useHasRole('admin');
  const { data, isLoading, error, refetch } = useConnections();
  const connect = useConnectGoogle();
  const sync = useSyncConnection();
  const [params, setParams] = useSearchParams();
  const handled = useRef(false);

  // Handle the redirect back from Google OAuth.
  useEffect(() => {
    if (handled.current) return;
    const connected = params.get('connected');
    const err = params.get('error');
    if (!connected && !err) return;
    handled.current = true;
    if (err) toast.error('Google connection failed', { description: err, duration: 10_000 });
    if (connected) {
      toast.success('Google account connected', { description: 'Syncing Business Profiles now…' });
      sync.mutate(connected);
    }
    setParams({}, { replace: true });
  }, [params, setParams, sync]);

  const needsReauth = (data ?? []).filter((c) => c.status === 'needs_reauth');

  return (
    <>
      <PageHeader
        eyebrow="Google"
        title="Connections"
        highlight="Connections"
        description="Gmail accounts connected through Google OAuth. Each one syncs the Business Profiles it can manage."
        actions={
          isAdmin && (
            <Button onClick={() => connect.mutate(undefined)} disabled={connect.isPending}>
              {connect.isPending ? <Loader2 className="animate-spin" /> : <Plug />}
              Connect Google Account
              <ButtonChip>
                <ArrowRight />
              </ButtonChip>
            </Button>
          )
        }
      />

      {needsReauth.length > 0 && (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 sm:flex-row sm:items-center"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>{needsReauth.map((c) => c.email).join(', ')}</strong>{' '}
            {needsReauth.length === 1 ? 'needs' : 'need'} to be reconnected. Posts using{' '}
            {needsReauth.length === 1 ? 'this account' : 'these accounts'} will fail until then.
          </p>
          {isAdmin && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => connect.mutate(needsReauth[0]!.email)}
              disabled={connect.isPending}
            >
              Reconnect {needsReauth.length === 1 ? '' : needsReauth[0]!.email}
            </Button>
          )}
        </div>
      )}

      <Card className="p-2 sm:p-4">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !data?.length ? (
          <EmptyState
            icon={Link2}
            title="No Google accounts connected"
            description="Connect a Gmail that manages your clients' Business Profiles. You can connect as many as you need."
            action={
              isAdmin ? (
                <Button onClick={() => connect.mutate(undefined)} disabled={connect.isPending}>
                  <Plug /> Connect Google Account
                </Button>
              ) : (
                <p className="text-sm text-orbit-muted">Ask an admin to connect a Google account.</p>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">GBP accounts</TableHead>
                    <TableHead className="text-right">Locations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last synced</TableHead>
                    {isAdmin && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <AccountCell connection={c} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{c.account_count}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{c.location_count}</TableCell>
                      <TableCell>
                        <ConnectionStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell>
                        <SyncedAt connection={c} syncing={sync.isPending && sync.variables === c.id} />
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <ConnectionActions connection={c} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="flex flex-col gap-3 md:hidden">
              {data.map((c) => (
                <li key={c.id} className="rounded-2xl border border-orbit-line bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <AccountCell connection={c} />
                    {isAdmin && <ConnectionActions connection={c} />}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <ConnectionStatusBadge status={c.status} />
                    <span>{pluralize(c.account_count, 'account')}</span>
                    <span>{pluralize(c.location_count, 'location')}</span>
                    <SyncedAt connection={c} syncing={sync.isPending && sync.variables === c.id} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}

function AccountCell({ connection: c }: { connection: ConnectionDTO }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar>
        {c.avatar_url && <AvatarImage src={c.avatar_url} alt="" referrerPolicy="no-referrer" />}
        <AvatarFallback>{initials(c.display_name ?? c.email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="wrap-anywhere font-bold text-orbit-heading">{c.email}</p>
        {c.display_name && <p className="wrap-anywhere text-xs text-orbit-muted">{c.display_name}</p>}
        {c.last_error && (
          <p className="mt-0.5 line-clamp-2 max-w-md text-xs text-rose-600" title={c.last_error}>
            {c.last_error}
          </p>
        )}
      </div>
    </div>
  );
}

function SyncedAt({ connection: c, syncing }: { connection: ConnectionDTO; syncing: boolean }) {
  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orbit-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Syncing…
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger className="text-sm text-orbit-body underline decoration-dotted underline-offset-4">
        {timeAgo(c.last_synced_at)}
      </TooltipTrigger>
      <TooltipContent>{c.last_synced_at ? formatLocal(c.last_synced_at) : 'Not synced yet'}</TooltipContent>
    </Tooltip>
  );
}

function ConnectionActions({ connection: c }: { connection: ConnectionDTO }) {
  const sync = useSyncConnection();
  const connect = useConnectGoogle();
  const disconnect = useDisconnect();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.email}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled={c.status !== 'active' || sync.isPending} onSelect={() => sync.mutate(c.id)}>
            <RefreshCw /> Sync now
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => connect.mutate(c.email)}>
            <Plug /> Reconnect
          </DropdownMenuItem>
          {c.status !== 'revoked' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                onSelect={() => setConfirmOpen(true)}
              >
                <Unplug /> Disconnect
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Disconnect ${c.email}?`}
        description={
          <>
            OrbitPost will revoke its Google access for this account and stop using it to publish.
            Scheduled posts that rely on it will fail until another account with access is chosen
            or it is reconnected.
          </>
        }
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => disconnect.mutateAsync(c.id)}
      />
    </>
  );
}
