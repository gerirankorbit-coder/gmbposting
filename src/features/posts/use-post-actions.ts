import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PostUpdate } from '../../../shared/schemas';
import type { BulkActionResult, PostListItemDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';

function useInvalidatePosts() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.postsAll });
    void qc.invalidateQueries({ queryKey: ['locations', 'posts'] });
  };
}

function bulk(path: string, verb: string) {
  return function useBulk() {
    const invalidate = useInvalidatePosts();
    return useMutation({
      mutationFn: (body: { ids: string[]; note?: string }) => api.post<BulkActionResult>(path, body),
      onSuccess: (r) => {
        if (r.updated) toast.success(`${pluralize(r.updated, 'post')} ${verb}`);
        if (r.skipped) toast.warning(`${pluralize(r.skipped, 'post')} skipped`, { description: 'Their status changed or they cannot be changed this way.' });
      },
      onError: (err) => toast.error(errorMessage(err)),
      onSettled: invalidate,
    });
  };
}

export const useApprovePosts = bulk('/posts/approve', 'approved and scheduled');
export const useRejectPosts = bulk('/posts/reject', 'sent back to drafts');
export const useSubmitPosts = bulk('/posts/submit', 'submitted');
export const useCancelPosts = bulk('/posts/cancel', 'cancelled');
export const useDeletePosts = bulk('/posts/delete', 'deleted');

function single<V>(fn: (v: V) => Promise<PostListItemDTO>, success: string) {
  return function useSingle() {
    const invalidate = useInvalidatePosts();
    const qc = useQueryClient();
    return useMutation({
      mutationFn: fn,
      onSuccess: (post) => {
        qc.setQueryData(qk.post(post.id), post);
        toast.success(success);
      },
      onError: (err) => toast.error(errorMessage(err)),
      onSettled: invalidate,
    });
  };
}

export const useUpdatePost = single(
  ({ id, patch }: { id: string; patch: PostUpdate }) => api.patch<PostListItemDTO>(`/posts/${id}`, patch),
  'Post updated',
);
export const useReschedulePost = single(
  ({ id, scheduled_at }: { id: string; scheduled_at: string }) => api.post<PostListItemDTO>(`/posts/${id}/reschedule`, { scheduled_at }),
  'Post rescheduled',
);
export const useRetryPost = single((id: string) => api.post<PostListItemDTO>(`/posts/${id}/retry`), 'Queued to publish again');
export const useDeleteFromGoogle = single(
  (id: string) => api.post<PostListItemDTO>(`/posts/${id}/delete-from-google`),
  'Deleted from Google',
);
