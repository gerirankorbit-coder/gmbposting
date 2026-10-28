import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Combine, Link as LinkIcon, MapPin, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import type { ClientDTO } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { pluralize } from '@/lib/format';
import { useClients } from '@/lib/queries';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/empty-state';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { ErrorState } from '@/components/app/error-state';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonChip } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ClientFormDialog } from './client-form-dialog';
import { MergeDialog } from './merge-dialog';
import { useDeleteClient, useUpdateClient } from './use-client-actions';

export function ClientsPage() {
  const canManage = useHasRole('manager');
  const { data, isLoading, error, refetch } = useClients();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [merging, setMerging] = useState<ClientDTO | null>(null);
  const [deleting, setDeleting] = useState<ClientDTO | null>(null);
  const del = useDeleteClient();
  const update = useUpdateClient();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((c) => (showInactive || c.is_active) && (!q || c.name.toLowerCase().includes(q)));
  }, [data, search, showInactive]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Brands"
        title="Clients"
        highlight="Clients"
        description="One client per brand. Group locations, set the brand voice for AI writing and the default link for CTA buttons."
        actions={
          canManage && (
            <Button onClick={openNew}>
              New client
              <ButtonChip>
                <Plus />
              </ButtonChip>
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="pl-9" aria-label="Search clients" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="show-inactive">Show inactive</Label>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={data?.length ? 'No clients match' : 'No clients yet'}
            description={
              data?.length
                ? 'Try another search, or show inactive clients.'
                : 'Clients are created automatically when locations sync. You can also add one yourself.'
            }
            action={canManage && !data?.length && <Button onClick={openNew}><Plus /> New client</Button>}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Card className="relative flex h-full flex-col overflow-hidden p-5">
                <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: c.color }} />
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-glow"
                    style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)` }}
                  >
                    {c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full rounded-2xl bg-white object-contain p-1" /> : c.name[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg">{c.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3" aria-hidden /> {pluralize(c.location_count, 'location')}
                      </Badge>
                      {!c.is_active && <Badge variant="gray">Inactive</Badge>}
                    </div>
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setMerging(c)}>
                          <Combine /> Merge others into this
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => update.mutate({ id: c.id, patch: { is_active: !c.is_active } })}>
                          <Users /> {c.is_active ? 'Mark inactive' : 'Mark active'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600 focus:bg-rose-50 focus:text-rose-700" onSelect={() => setDeleting(c)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="mt-4 line-clamp-3 flex-1 text-sm text-orbit-muted">
                  {c.brand_voice || <span className="italic">No brand voice yet.</span>}
                </p>
                {c.default_cta_url && (
                  <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-orbit-body">
                    <LinkIcon className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{c.default_cta_url.replace(/^https?:\/\//, '')}</span>
                  </p>
                )}
                <Button asChild variant="link" size="sm" className="mt-3 h-auto self-start px-0">
                  <Link to={`/locations?clientId=${c.id}&status=all`}>
                    View locations <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ClientFormDialog client={editing} open={formOpen} onOpenChange={setFormOpen} />
      <MergeDialog target={merging} clients={data ?? []} open={!!merging} onOpenChange={(o) => !o && setMerging(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'client'}?`}
        description={
          <>
            Its {pluralize(deleting?.location_count ?? 0, 'location')} become unassigned, and its image
            library and brand kit are removed. Posts are not deleted.
          </>
        }
        confirmLabel="Delete client"
        destructive
        onConfirm={() => (deleting ? del.mutateAsync(deleting.id) : undefined)}
      />
    </>
  );
}
