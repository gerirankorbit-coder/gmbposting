import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationFeedDTO } from '../../../shared/types';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';

export function useNotificationFeed(params: { type?: string; clientId?: string; unread?: string; page: number; pageSize: number }, poll = false) {
  return useQuery({
    queryKey: qk.notifications(params),
    queryFn: () => api.get<NotificationFeedDTO>('/notifications', params),
    refetchInterval: poll ? 60_000 : false,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/notifications/read', { ids }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: qk.notificationsAll });
      qc.setQueriesData<NotificationFeedDTO>({ queryKey: ['notifications', 'list'] }, (old) =>
        old
          ? {
              ...old,
              unread: Math.max(0, old.unread - old.items.filter((n) => ids.includes(n.id) && !n.is_read).length),
              items: old.items.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
            }
          : old,
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.notificationsAll }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: qk.notificationsAll });
      qc.setQueriesData<NotificationFeedDTO>({ queryKey: ['notifications', 'list'] }, (old) =>
        old ? { ...old, unread: 0, items: old.items.map((n) => ({ ...n, is_read: true })) } : old,
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.notificationsAll }),
  });
}
