import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LocationBulkUpdate, LocationUpdate } from '../../../shared/schemas';
import type { HistoryImportResult, LocationDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { qk } from '@/lib/query-keys';

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LocationUpdate }) =>
      api.patch<LocationDTO>(`/locations/${id}`, patch),
    onSuccess: (loc) => {
      qc.setQueryData(qk.location(loc.id), loc);
      void qc.invalidateQueries({ queryKey: qk.locationsAll });
      void qc.invalidateQueries({ queryKey: qk.clients });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function useBulkUpdateLocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LocationBulkUpdate) => api.post<{ updated: number }>('/locations/bulk', body),
    onSuccess: ({ updated }) => toast.success(`Updated ${pluralize(updated, 'location')}`),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.locationsAll });
      void qc.invalidateQueries({ queryKey: qk.clients });
    },
  });
}

export function useImportHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<HistoryImportResult>(`/locations/${id}/import-history`),
    onSuccess: (r, id) => {
      toast.success(
        r.imported ? `Imported ${pluralize(r.imported, 'post')} from Google` : 'No new posts to import',
        { description: `${pluralize(r.found, 'post')} found on Google, ${r.skipped} already in OrbitPost.` },
      );
      void qc.invalidateQueries({ queryKey: ['locations', 'posts', id] });
      void qc.invalidateQueries({ queryKey: qk.location(id) });
    },
    onError: (err) => toast.error('History import failed', { description: errorMessage(err) }),
  });
}
