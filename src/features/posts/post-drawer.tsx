import { useQuery } from '@tanstack/react-query';
import type { PostListItemDTO } from '../../../shared/types';
import { api } from '@/lib/api';
import { formatInZone, formatLocal } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { ClientDot } from '@/components/app/client-dot';
import { PostPreview } from '@/components/app/post-preview';
import { PostStatusBadge } from '@/components/app/status-badge';
import { ZonedTime } from '@/components/app/zoned-time';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { PostAction } from './post-actions';

const IMAGE_SOURCE_LABEL: Record<string, string> = {
  auto: 'Auto (picked at publish time)',
  upload: 'Uploaded image',
  library: 'Client library',
  branded: 'Branded graphic',
  sheet: 'From spreadsheet',
  none: 'No image',
};

export function PostDrawer({
  post: initial,
  open,
  onOpenChange,
  actionsFor,
}: {
  post: PostListItemDTO | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  actionsFor: (p: PostListItemDTO) => PostAction[];
}) {
  // Keep the drawer fresh after actions (status changes, edits).
  const { data } = useQuery({
    queryKey: qk.post(initial?.id ?? ''),
    queryFn: () => api.get<PostListItemDTO>(`/posts/${initial!.id}`),
    enabled: open && !!initial,
    initialData: initial ?? undefined,
  });
  const post = data ?? initial;
  if (!post) return null;
  const tz = post.location?.timezone ?? 'UTC';
  const actions = actionsFor(post);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={(e) => {
          // Focus the panel itself rather than the first control (which would pop a tooltip).
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            <PostStatusBadge status={post.status} />
            <span className="text-xs font-semibold uppercase tracking-wide text-orbit-muted">
              {post.topic_type === 'STANDARD' ? 'Update' : post.topic_type === 'OFFER' ? 'Offer' : 'Event'}
            </span>
          </div>
          <SheetTitle>{post.location?.title ?? 'Post'}</SheetTitle>
          <SheetDescription>{post.campaign?.name ?? 'No campaign'}</SheetDescription>
        </SheetHeader>

        {post.last_error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="font-bold">Last error{post.attempts ? ` (attempt ${post.attempts})` : ''}</p>
            <p className="mt-0.5">{post.last_error}</p>
            {post.next_attempt_at && <p className="mt-1 text-xs">Next automatic retry: {formatLocal(post.next_attempt_at)}</p>}
          </div>
        )}
        {post.review_note && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-bold">Reviewer note</p>
            <p className="mt-0.5 whitespace-pre-line">{post.review_note}</p>
          </div>
        )}

        <PostPreview
          businessName={post.location?.title ?? ''}
          topicType={post.topic_type}
          summary={post.summary}
          imageMode={post.media_url ? 'image' : post.image_source === 'auto' ? 'auto' : 'none'}
          imageUrl={post.media_url}
          ctaType={post.cta_type}
          eventTitle={post.event_title}
          eventRange={
            post.event_start && post.event_end
              ? `${formatInZone(post.event_start, tz, 'MMM d, h:mm a')} – ${formatInZone(post.event_end, tz, 'MMM d, h:mm a')}`
              : null
          }
          couponCode={post.offer_coupon_code}
          whenLabel={post.published_at ? formatInZone(post.published_at, tz, 'MMM d, yyyy') : post.scheduled_at ? `Scheduled · ${formatInZone(post.scheduled_at, tz, 'MMM d, h:mm a')}` : 'Not scheduled'}
        />

        <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
          <dt className="text-orbit-muted">Client</dt>
          <dd>
            <ClientDot client={post.location?.client ?? null} />
          </dd>
          <dt className="text-orbit-muted">Publish with</dt>
          <dd className="wrap-anywhere text-orbit-heading">{post.connection_email ?? '—'}</dd>
          <dt className="text-orbit-muted">Scheduled</dt>
          <dd>
            <ZonedTime iso={post.scheduled_at} timeZone={tz} />
          </dd>
          {post.published_at && (
            <>
              <dt className="text-orbit-muted">Published</dt>
              <dd>
                <ZonedTime iso={post.published_at} timeZone={tz} />
              </dd>
            </>
          )}
          <dt className="text-orbit-muted">Image</dt>
          <dd className="text-orbit-heading">{IMAGE_SOURCE_LABEL[post.image_source] ?? post.image_source}</dd>
          {post.cta_url && (
            <>
              <dt className="text-orbit-muted">Button link</dt>
              <dd className="wrap-anywhere">
                <a href={post.cta_url} target="_blank" rel="noreferrer" className="text-orbit-primary hover:underline">
                  {post.cta_url}
                </a>
              </dd>
            </>
          )}
          {post.offer_terms && (
            <>
              <dt className="text-orbit-muted">Terms</dt>
              <dd className="whitespace-pre-line text-orbit-heading">{post.offer_terms}</dd>
            </>
          )}
          <dt className="text-orbit-muted">Created</dt>
          <dd className="text-orbit-heading">{formatLocal(post.created_at)}</dd>
        </dl>

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-orbit-line pt-4">
            {actions.map((a) =>
              a.href ? (
                <Button key={a.key} asChild variant="outline" size="sm">
                  <a href={a.href} target="_blank" rel="noreferrer">
                    <a.icon /> {a.label}
                  </a>
                </Button>
              ) : (
                <Button
                  key={a.key}
                  size="sm"
                  variant={a.destructive ? 'outline' : a.key === 'approve' ? 'default' : 'outline'}
                  className={a.destructive ? 'border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50' : undefined}
                  onClick={a.run}
                >
                  <a.icon /> {a.label}
                </Button>
              ),
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
