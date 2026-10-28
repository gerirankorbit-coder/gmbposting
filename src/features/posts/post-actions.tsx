import { useState, type ReactNode } from 'react';
import {
  Ban,
  CalendarClock,
  CheckCheck,
  ExternalLink,
  Pencil,
  RotateCw,
  Send,
  Trash2,
  Undo2,
  Wand2,
} from 'lucide-react';
import type { PostListItemDTO } from '../../../shared/types';
import { useHasRole, useMe } from '@/app/auth';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { BrandedDialog } from './branded-dialog';
import { PostDrawer } from './post-drawer';
import { PostEditDialog } from './post-edit-dialog';
import { RejectDialog } from './reject-dialog';
import { RescheduleDialog } from './reschedule-dialog';
import {
  useApprovePosts,
  useCancelPosts,
  useDeleteFromGoogle,
  useDeletePosts,
  useRetryPost,
  useSubmitPosts,
} from './use-post-actions';

export interface PostAction {
  key: string;
  label: string;
  icon: typeof Pencil;
  run: () => void;
  destructive?: boolean;
  href?: string;
}

type Confirm = { title: string; description: ReactNode; label: string; destructive?: boolean; run: () => Promise<unknown> };

/**
 * Hosts the post drawer and every post dialog for a page. `actionsFor(post)` returns the actions
 * the current user may take on a post, based on its status and their role.
 */
export function usePostUi() {
  const isManager = useHasRole('manager');
  const isAdmin = useHasRole('admin');
  const { data: me } = useMe();
  const [drawer, setDrawer] = useState<PostListItemDTO | null>(null);
  const [editing, setEditing] = useState<PostListItemDTO | null>(null);
  const [rescheduling, setRescheduling] = useState<PostListItemDTO | null>(null);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [branding, setBranding] = useState<PostListItemDTO | null>(null);

  const approve = useApprovePosts();
  const submit = useSubmitPosts();
  const cancel = useCancelPosts();
  const del = useDeletePosts();
  const retry = useRetryPost();
  const deleteFromGoogle = useDeleteFromGoogle();

  const actionsFor = (p: PostListItemDTO): PostAction[] => {
    const a: PostAction[] = [];
    const editable =
      p.status === 'draft' || p.status === 'pending_approval' || (isManager && (p.status === 'scheduled' || p.status === 'failed'));
    if (editable) a.push({ key: 'edit', label: 'Edit', icon: Pencil, run: () => setEditing(p) });
    if (p.status === 'draft') a.push({ key: 'submit', label: 'Submit for approval', icon: Send, run: () => submit.mutate({ ids: [p.id] }) });
    if (isManager && (p.status === 'pending_approval' || p.status === 'draft')) {
      a.push({ key: 'approve', label: 'Approve & schedule', icon: CheckCheck, run: () => approve.mutate({ ids: [p.id] }) });
    }
    if (isManager && p.status === 'pending_approval') a.push({ key: 'reject', label: 'Send back', icon: Undo2, run: () => setRejecting([p.id]) });
    if (isManager && ['draft', 'pending_approval', 'scheduled', 'failed'].includes(p.status)) {
      a.push({ key: 'reschedule', label: 'Reschedule', icon: CalendarClock, run: () => setRescheduling(p) });
    }
    if (isManager && p.status === 'failed') a.push({ key: 'retry', label: 'Retry now', icon: RotateCw, run: () => retry.mutate(p.id) });
    if (isAdmin && ['draft', 'pending_approval', 'scheduled', 'failed'].includes(p.status) && p.location?.client) {
      a.push({ key: 'branded', label: p.image_source === 'branded' ? 'Regenerate branded image' : 'Branded image', icon: Wand2, run: () => setBranding(p) });
    }
    if (p.google_search_url) {
      a.push({ key: 'view', label: 'View on Google', icon: ExternalLink, href: p.google_search_url, run: () => window.open(p.google_search_url!, '_blank', 'noopener') });
    }
    if (isManager && ['draft', 'pending_approval', 'scheduled', 'failed'].includes(p.status)) {
      a.push({
        key: 'cancel',
        label: 'Cancel post',
        icon: Ban,
        destructive: true,
        run: () =>
          setConfirm({
            title: 'Cancel this post?',
            description: 'It will not be published. You can still find it in the queue under Cancelled.',
            label: 'Cancel post',
            destructive: true,
            run: () => cancel.mutateAsync({ ids: [p.id] }),
          }),
      });
    }
    if (isAdmin && p.status === 'published' && p.google_post_name) {
      a.push({
        key: 'delete-google',
        label: 'Delete from Google',
        icon: Trash2,
        destructive: true,
        run: () =>
          setConfirm({
            title: 'Delete this post from Google?',
            description: `The live post on ${p.location?.title ?? 'this Business Profile'} will be removed from Google. This cannot be undone.`,
            label: 'Delete from Google',
            destructive: true,
            run: () => deleteFromGoogle.mutateAsync(p.id),
          }),
      });
    }
    const canDeleteRecord =
      !p.google_post_name &&
      ((isManager && ['draft', 'cancelled', 'pending_approval'].includes(p.status)) || (p.status === 'draft' && p.created_by === me?.id));
    if (canDeleteRecord) {
      a.push({
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        destructive: true,
        run: () =>
          setConfirm({
            title: 'Delete this post?',
            description: 'The post is removed from OrbitPost permanently.',
            label: 'Delete',
            destructive: true,
            run: () => del.mutateAsync({ ids: [p.id] }),
          }),
      });
    }
    return a;
  };

  const elements = (
    <>
      <PostDrawer
        post={drawer}
        open={!!drawer}
        onOpenChange={(o) => !o && setDrawer(null)}
        actionsFor={actionsFor}
      />
      <PostEditDialog post={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <RescheduleDialog post={rescheduling} open={!!rescheduling} onOpenChange={(o) => !o && setRescheduling(null)} />
      <RejectDialog ids={rejecting ?? []} open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)} />
      <BrandedDialog post={branding} open={!!branding} onOpenChange={(o) => !o && setBranding(null)} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={confirm?.label}
        destructive={confirm?.destructive}
        onConfirm={async () => {
          await confirm?.run();
          setDrawer(null);
        }}
      />
    </>
  );

  return {
    actionsFor,
    openDrawer: setDrawer,
    openReject: setRejecting,
    elements,
    pending: approve.isPending || submit.isPending || cancel.isPending || retry.isPending,
  };
}
