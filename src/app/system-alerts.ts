import { useQuery } from '@tanstack/react-query';
import type { SystemAlertsDTO } from '../../shared/types';
import type { SystemAlert } from '@/components/layout/announcement-bar';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/** System-wide alerts for the gradient bar: reconnect needed, client libraries empty. */
export function useSystemAlerts(): SystemAlert[] {
  const { data } = useQuery({
    queryKey: qk.alerts,
    queryFn: () => api.get<SystemAlertsDTO>('/notifications/alerts'),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const alerts: SystemAlert[] = [];
  const reauth = data?.needsReauth.length ?? 0;
  if (reauth > 0) {
    alerts.push({
      id: 'reauth',
      message: `⚠️ ${reauth} Google connection${reauth === 1 ? ' needs' : 's need'} reconnecting`,
      link: '/connections',
    });
  }
  const empty = data?.emptyLibraries ?? [];
  if (empty.length === 1) {
    alerts.push({ id: 'empty', message: `🖼️ ${empty[0]!.name} is out of images (branded graphics in use)`, link: `/library/${empty[0]!.id}` });
  } else if (empty.length > 1) {
    alerts.push({ id: 'empty', message: `🖼️ ${empty.length} clients are out of images`, link: '/library' });
  }
  return alerts;
}
