import type { SystemAlert } from '@/components/layout/announcement-bar';
import { useConnections } from '@/lib/queries';

/** System-wide alerts shown in the gradient bar at the top of the app. */
export function useSystemAlerts(): SystemAlert[] {
  const { data: connections } = useConnections();
  const alerts: SystemAlert[] = [];
  const reauth = (connections ?? []).filter((c) => c.status === 'needs_reauth').length;
  if (reauth > 0) {
    alerts.push({
      id: 'reauth',
      message: `⚠️ ${reauth} Google connection${reauth === 1 ? ' needs' : 's need'} reconnecting`,
      link: '/connections',
    });
  }
  return alerts;
}
