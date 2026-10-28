import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { ClientDTO } from '../../../shared/types';
import { pluralize } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useMergeClients } from './use-client-actions';

export function MergeDialog({
  target,
  clients,
  open,
  onOpenChange,
}: {
  target: ClientDTO | null;
  clients: ClientDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const merge = useMergeClients();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch('');
    }
  }, [open]);
  const options = useMemo(
    () =>
      clients.filter(
        (c) => c.id !== target?.id && c.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [clients, target, search],
  );
  if (!target) return null;
  const moving = clients.filter((c) => selected.has(c.id)).reduce((n, c) => n + c.location_count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge into {target.name}</DialogTitle>
          <DialogDescription>
            The selected clients' locations and images move to <strong>{target.name}</strong>, then
            the selected clients are deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="pl-9" />
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-orbit-line bg-white/70 p-2">
          {options.length === 0 && <li className="p-4 text-center text-sm text-orbit-muted">No other clients.</li>}
          {options.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-orbit-primary/5">
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(c.id);
                    else next.delete(c.id);
                    setSelected(next);
                  }}
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                <span className="flex-1 truncate text-sm font-semibold text-orbit-heading">{c.name}</span>
                <span className="text-xs text-orbit-muted">{pluralize(c.location_count, 'location')}</span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected.size || merge.isPending}
            onClick={() =>
              merge.mutate({ id: target.id, sourceIds: [...selected] }, { onSuccess: () => onOpenChange(false) })
            }
          >
            {merge.isPending && <Loader2 className="animate-spin" />}
            Merge {selected.size ? `${selected.size} (${pluralize(moving, 'location')})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
