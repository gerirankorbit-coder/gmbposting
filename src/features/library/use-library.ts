import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { BrandKitUpdate } from '../../../shared/schemas';
import type { ClientDTO, ClientStockDTO, LibraryImageDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query-keys';

export interface ClientLibrary {
  stock: ClientStockDTO;
  images: LibraryImageDTO[];
}

export function useClientLibrary(clientId: string) {
  return useQuery({
    queryKey: qk.libraryClient(clientId),
    queryFn: () => api.get<ClientLibrary>(`/library/${clientId}`),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.libraryAll });
    void qc.invalidateQueries({ queryKey: qk.clients });
    void qc.invalidateQueries({ queryKey: qk.notificationsAll });
  };
}

export function useUpdateImage(clientId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { is_active?: boolean; location_id?: string | null } }) =>
      api.patch<LibraryImageDTO>(`/library/images/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.libraryClient(clientId) });
      const prev = qc.getQueryData<ClientLibrary>(qk.libraryClient(clientId));
      if (prev) qc.setQueryData<ClientLibrary>(qk.libraryClient(clientId), { ...prev, images: prev.images.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.libraryClient(clientId), ctx.prev);
      toast.error(errorMessage(err));
    },
    onSettled: invalidate,
  });
}

export function useDeleteImage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/library/images/${id}`),
    onSuccess: () => toast.success('Image deleted'),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });
}

export function useSaveBrandKit(clientId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: BrandKitUpdate) => api.patch<ClientDTO>(`/library/${clientId}/brand`, patch),
    onSuccess: () => toast.success('Saved'),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });
}

export function useLogo(clientId: string) {
  const invalidate = useInvalidate();
  const upload = useMutation({
    mutationFn: (path: string) => api.post<ClientDTO>(`/library/${clientId}/logo`, { path }),
    onSuccess: () => toast.success('Logo updated'),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => api.delete<ClientDTO>(`/library/${clientId}/logo`),
    onSuccess: () => toast.success('Logo removed'),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });
  return { upload, remove };
}
