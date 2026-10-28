import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SyncResultDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';

export function useConnectGoogle() {
  return useMutation({
    mutationFn: (loginHint?: string) => api.post<{ url: string }>('/google/connect', loginHint ? { loginHint } : {}),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function useSyncConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<SyncResultDTO>(`/connections/${id}/sync`),
    onSuccess: (r) => {
      const parts = [pluralize(r.accounts, 'account'), pluralize(r.locations, 'location')];
      if (r.newLocations) parts.push(`${r.newLocations} new`);
      if (r.complete) toast.success(`Synced ${r.email}`, { description: parts.join(' · ') });
      else toast.warning(`Partially synced ${r.email}`, { description: r.errors.join('\n') });
    },
    onError: (err) => toast.error('Sync failed', { description: errorMessage(err) }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.connections });
      void qc.invalidateQueries({ queryKey: qk.locationsAll });
      void qc.invalidateQueries({ queryKey: qk.clients });
    },
  });
}

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true; tokenRevoked: boolean }>(`/connections/${id}`),
    onSuccess: () => toast.success('Google account disconnected'),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.connections });
      void qc.invalidateQueries({ queryKey: qk.locationsAll });
    },
  });
}
