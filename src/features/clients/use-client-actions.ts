import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ClientInput, ClientUpdate } from '../../../shared/schemas';
import type { ClientDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query-keys';

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.clients });
    void qc.invalidateQueries({ queryKey: qk.locationsAll });
  };
}

export function useCreateClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: ClientInput) => api.post<ClientDTO>('/clients', body),
    onSuccess: (c) => toast.success(`Client "${c.name}" created`),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });
}

export function useUpdateClient() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ClientUpdate }) => api.patch<ClientDTO>(`/clients/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      // Optimistic for simple toggles (active flag) on the list.
      await qc.cancelQueries({ queryKey: qk.clients });
      const prev = qc.getQueryData<ClientDTO[]>(qk.clients);
      if (prev) {
        qc.setQueryData<ClientDTO[]>(
          qk.clients,
          prev.map((c) => (c.id === id ? ({ ...c, ...patch } as ClientDTO) : c)),
        );
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.clients, ctx.prev);
      toast.error(errorMessage(err));
    },
    onSettled: invalidate,
  });
}

export function useDeleteClient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/clients/${id}`),
    onSuccess: () => toast.success('Client deleted'),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });
}

export function useMergeClients() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, sourceIds }: { id: string; sourceIds: string[] }) =>
      api.post<ClientDTO>(`/clients/${id}/merge`, { sourceIds }),
    onSuccess: (c) => toast.success(`Merged into "${c.name}"`, { description: `${c.location_count} locations now belong to it.` }),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });
}
