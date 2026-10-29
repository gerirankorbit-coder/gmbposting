import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Power, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { LocationDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { ClientDot } from '@/components/app/client-dot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Activates (or deactivates) clients; only locations of active clients can post. */
export function useSetClientsActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean }) => {
      for (const id of ids) await api.patch(`/clients/${id}`, { is_active: active });
      return { count: ids.length, active };
    },
    onSuccess: ({ count, active }) =>
      toast.success(`${count === 1 ? 'Client' : `${count} clients`} ${active ? 'activated' : 'deactivated'}`, {
        description: active ? 'Their locations can now be posted to.' : 'Nothing will be posted for them until reactivated.',
      }),
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.clients });
      void qc.invalidateQueries({ queryKey: qk.locationsAll });
      void qc.invalidateQueries({ queryKey: qk.locationOptions });
      void qc.invalidateQueries({ queryKey: qk.postingStatusAll });
    },
  });
}

/** Client name plus, for an inactive client, a badge and a one-click Activate button. */
export function ClientStatusCell({ location, canManage }: { location: LocationDTO; canManage: boolean }) {
  const setActive = useSetClientsActive();
  const client = location.client;
  return (
    <div className="grid justify-items-start gap-1">
      <ClientDot client={client} />
      {client && !client.is_active && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="gray">Inactive client</Badge>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs"
              disabled={setActive.isPending}
              onClick={() => setActive.mutate({ ids: [client.id], active: true })}
            >
              {setActive.isPending ? <Loader2 className="animate-spin" /> : <Power />} Activate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Shown when Google says the profile cannot take posts (unverified, pending or suspended). */
export function UnverifiedBadge({ location }: { location: Pick<LocationDTO, 'google_verified'> }) {
  if (location.google_verified !== false) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Badge variant="rose">
            <ShieldAlert className="h-3 w-3" aria-hidden /> Not verified on Google
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Google reports this profile as unverified, pending verification or suspended, so it cannot take posts. Finish
        verification in Google Business Profile; the next sync picks it up automatically.
      </TooltipContent>
    </Tooltip>
  );
}
