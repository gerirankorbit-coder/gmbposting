import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCheck, Eye, Loader2, Pencil, Undo2, X } from 'lucide-react';
import { contentWarnings } from '../../../shared/content';
import type { Paginated, PostListItemDTO } from '../../../shared/types';
import { api } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { CharCounter } from '@/components/app/char-counter';
import { ClientDot } from '@/components/app/client-dot';
import { ErrorState } from '@/components/app/error-state';
import { CTA_BUTTON_LABEL } from '@/components/app/post-preview';
import { ZonedTime } from '@/components/app/zoned-time';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePostUi } from '@/features/posts/post-actions';
import { PostThumb } from '@/features/posts/post-thumb';
import { useApprovePosts, useUpdatePost } from '@/features/posts/use-post-actions';

const QUERY = { status: 'pending_approval', sort: 'scheduled_at', dir: 'asc', page: 1, pageSize: 500 };

export function ApprovalsPage() {
  const ui = usePostUi();
  const approve = useApprovePosts();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: qk.posts(QUERY),
    queryFn: () => api.get<Paginated<PostListItemDTO>>('/posts', QUERY),
  });

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; posts: PostListItemDTO[] }>();
    for (const p of data?.items ?? []) {
      const key = p.campaign?.id ?? 'none';
      const g = map.get(key) ?? { name: p.campaign?.name ?? 'Without campaign', posts: [] };
      g.posts.push(p);
      map.set(key, g);
    }
    return [...map.entries()];
  }, [data]);

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected(next);
  };
  const selectedIds = [...selected].filter((id) => data?.items.some((p) => p.id === id));
  const approveIds = (ids: string[]) => approve.mutate({ ids }, { onSuccess: () => toggle(ids, false) });

  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="Approvals"
        highlight="Approvals"
        description="Review every post before it goes live. Edit inline, approve in bulk, or send it back with a note."
      />

      {selectedIds.length > 0 && (
        <div className="sticky top-24 z-20 mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-white/90 p-3 shadow-glow backdrop-blur-xl" role="region" aria-label="Bulk actions">
          <span className="mr-1 text-sm font-bold text-orbit-heading">{selectedIds.length} selected</span>
          <Button size="sm" onClick={() => approveIds(selectedIds)} disabled={approve.isPending}>
            {approve.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />} Approve &amp; schedule
          </Button>
          <Button size="sm" variant="outline" onClick={() => ui.openReject(selectedIds)}>
            <Undo2 /> Send back
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X /> Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCheck} title="Nothing waiting for approval" description="Posts submitted for review appear here, grouped by campaign." />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, group]) => {
            const ids = group.posts.map((p) => p.id);
            const all = ids.every((id) => selected.has(id));
            const some = ids.some((id) => selected.has(id));
            return (
              <Card key={key} className="p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Checkbox checked={all ? true : some ? 'indeterminate' : false} onCheckedChange={(v) => toggle(ids, !!v)} aria-label={`Select all in ${group.name}`} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg">{group.name}</h2>
                    <p className="text-xs text-orbit-muted">{pluralize(group.posts.length, 'post')} waiting</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => approveIds(ids)} disabled={approve.isPending}>
                    <CheckCheck /> Approve all {group.posts.length}
                  </Button>
                </div>
                <ul className="grid gap-3 xl:grid-cols-2">
                  {group.posts.map((p) => (
                    <ApprovalCard
                      key={p.id}
                      post={p}
                      selected={selected.has(p.id)}
                      onSelect={(v) => toggle([p.id], v)}
                      onApprove={() => approveIds([p.id])}
                      onReject={() => ui.openReject([p.id])}
                      onOpen={() => ui.openDrawer(p)}
                      busy={approve.isPending}
                    />
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
      {ui.elements}
    </>
  );
}

function ApprovalCard({
  post: p,
  selected,
  onSelect,
  onApprove,
  onReject,
  onOpen,
  busy,
}: {
  post: PostListItemDTO;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onOpen: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(p.summary);
  const update = useUpdatePost();
  const warnings = contentWarnings(editing ? text : p.summary);
  return (
    <li className={`rounded-2xl border bg-white/75 p-4 transition ${selected ? 'border-orbit-primary/50 ring-2 ring-orbit-primary/15' : 'border-orbit-line'}`}>
      <div className="flex items-start gap-3">
        <Checkbox className="mt-1" checked={selected} onCheckedChange={(v) => onSelect(!!v)} aria-label={`Select post for ${p.location?.title}`} />
        <PostThumb post={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-orbit-heading">{p.location?.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-orbit-muted">
            <ClientDot client={p.location?.client ?? null} className="text-xs" />
            <ZonedTime iso={p.scheduled_at} timeZone={p.location?.timezone ?? 'UTC'} className="text-xs underline decoration-dotted underline-offset-2" />
            {p.cta_type && <Badge variant="outline">{CTA_BUTTON_LABEL[p.cta_type]}</Badge>}
            {p.topic_type !== 'STANDARD' && <Badge variant="violet">{p.topic_type === 'OFFER' ? 'Offer' : 'Event'}</Badge>}
          </div>
        </div>
      </div>
      {p.event_title && <p className="mt-3 text-sm font-bold text-orbit-heading">{p.event_title}</p>}
      {editing ? (
        <div className="mt-3 grid gap-1.5">
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} aria-label="Post text" />
          <div className="flex items-center justify-between">
            <CharCounter length={text.length} />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setText(p.summary); setEditing(false); }}>
                Cancel
              </Button>
              <Button size="sm" disabled={update.isPending || text.length > 1500 || !text.trim()} onClick={() => update.mutate({ id: p.id, patch: { summary: text } }, { onSuccess: () => setEditing(false) })}>
                {update.isPending && <Loader2 className="animate-spin" />} Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm text-orbit-body">{p.summary}</p>
      )}
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove} disabled={busy}>
          <CheckCheck /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          <Undo2 /> Send back
        </Button>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil /> Edit text
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onOpen}>
          <Eye /> Details
        </Button>
      </div>
    </li>
  );
}
