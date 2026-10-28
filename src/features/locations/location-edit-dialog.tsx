import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LocationDTO } from '../../../shared/types';
import { useClients } from '@/lib/queries';
import { TimezoneSelect } from '@/components/app/timezone-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUpdateLocation } from './use-location-actions';

const NONE = '__none__';

export function LocationEditDialog({
  location,
  open,
  onOpenChange,
}: {
  location: LocationDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: clients } = useClients();
  const update = useUpdateLocation();
  const [clientId, setClientId] = useState<string>(NONE);
  const [timezone, setTimezone] = useState('');
  const [defaultConn, setDefaultConn] = useState<string>(NONE);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!location || !open) return;
    setClientId(location.client?.id ?? NONE);
    setTimezone(location.timezone);
    setDefaultConn(location.default_connection_id ?? NONE);
    setActive(location.is_active);
  }, [location, open]);

  if (!location) return null;

  const save = () => {
    update.mutate(
      {
        id: location.id,
        patch: {
          client_id: clientId === NONE ? null : clientId,
          timezone,
          default_connection_id: defaultConn === NONE ? null : defaultConn,
          is_active: active,
        },
      },
      {
        onSuccess: () => {
          toast.success('Location updated');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit location</DialogTitle>
          <DialogDescription>{location.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="loc-client">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="loc-client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="loc-tz">Time zone</Label>
            <TimezoneSelect id="loc-tz" value={timezone} onChange={setTimezone} />
            <p className="text-xs text-orbit-muted">Schedules and spreadsheet times use this zone.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="loc-conn">Default Gmail for publishing</Label>
            <Select value={defaultConn} onValueChange={setDefaultConn}>
              <SelectTrigger id="loc-conn">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Automatic (first active account)</SelectItem>
                {location.access.map((a) => (
                  <SelectItem key={a.connection_id} value={a.connection_id} disabled={a.status !== 'active'}>
                    {a.email}
                    {a.status !== 'active' ? ' (needs reconnect)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-orbit-line bg-white/70 px-4 py-3">
            <div>
              <Label htmlFor="loc-active">Active</Label>
              <p className="text-xs text-orbit-muted">Inactive locations are hidden from compose and imports.</p>
            </div>
            <Switch id="loc-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending || !timezone}>
            {update.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
