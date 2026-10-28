import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ImportRowPatch } from '../../../shared/schemas';
import type { ImportDetailDTO, ImportOptions } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query-keys';

export function useImportDetail(id: string) {
  return useQuery({ queryKey: qk.importDetail(id), queryFn: () => api.get<ImportDetailDTO>(`/imports/${id}`) });
}

function useSetDetail(id: string) {
  const qc = useQueryClient();
  return (d: ImportDetailDTO) => {
    qc.setQueryData(qk.importDetail(id), d);
    void qc.invalidateQueries({ queryKey: ['imports', 'list'] });
  };
}

export function useUpdateImportRow(id: string) {
  const set = useSetDetail(id);
  return useMutation({
    mutationFn: ({ rowId, patch }: { rowId: string; patch: ImportRowPatch }) => api.patch<ImportDetailDTO>(`/imports/${id}/rows/${rowId}`, patch),
    onSuccess: set,
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function useUpdateImportOptions(id: string) {
  const set = useSetDetail(id);
  return useMutation({
    mutationFn: (options: ImportOptions) => api.patch<ImportDetailDTO>(`/imports/${id}/options`, options),
    onSuccess: set,
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export function useCommitImport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: 'submit' | 'approve') => api.post<{ created: number; campaignId: string; status: string }>(`/imports/${id}/commit`, { mode }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.importsAll });
      void qc.invalidateQueries({ queryKey: qk.postsAll });
      void qc.invalidateQueries({ queryKey: qk.notificationsAll });
    },
    onError: (err) => toast.error('Commit failed', { description: errorMessage(err) }),
  });
}

export function useDiscardImport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/imports/${id}/discard`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.importsAll });
      toast.success('Import discarded');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
