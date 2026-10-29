import { useMemo, useState } from 'react';
import { Ban, Search, X } from 'lucide-react';
import { postingBlockReason } from '../../../shared/posting';
import type { ClientDTO, LocationDTO } from '../../../shared/types';
import { ClientDot } from '@/components/app/client-dot';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { defaultConnectionFor, type ComposeState } from './compose-state';

const RENDER_LIMIT = 250;
const ALL = 'all';

export function StepLocations({
  state,
  patch,
  locations,
  clients,
}: {
  state: ComposeState;
  patch: (p: Partial<ComposeState>) => void;
  locations: LocationDTO[];
  clients: ClientDTO[];
}) {
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState(ALL);
  const [showBlocked, setShowBlocked] = useState(false);
  const selected = useMemo(() => new Set(state.selected), [state.selected]);
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locations.filter(
      (l) =>
        (clientId === ALL || (clientId === 'none' ? !l.client : l.client?.id === clientId)) &&
        (!q || `${l.title} ${l.city ?? ''} ${l.address_text ?? ''} ${l.client?.name ?? ''}`.toLowerCase().includes(q)),
    );
  }, [locations, search, clientId]);
  // Only locations of active clients that Google lets us post on can be picked.
  const blockedReason = useMemo(() => new Map(locations.map((l) => [l.id, postingBlockReason(l)])), [locations]);
  const filtered = useMemo(() => matching.filter((l) => !blockedReason.get(l.id)), [matching, blockedReason]);
  const blocked = useMemo(() => matching.filter((l) => blockedReason.get(l.id)), [matching, blockedReason]);

  const setSelection = (ids: string[]) => {
    const connections = { ...state.connections };
    for (const id of ids) {
      if (!connections[id]) {
        const loc = byId.get(id);
        const conn = loc && defaultConnectionFor(loc);
        if (conn) connections[id] = conn;
      }
    }
    patch({ selected: ids, connections });
  };
  const toggle = (id: string) =>
    setSelection(selected.has(id) ? state.selected.filter((s) => s !== id) : [...state.selected, id]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const selectAllFiltered = () => {
    if (allFilteredSelected) {
      const remove = new Set(filtered.map((l) => l.id));
      setSelection(state.selected.filter((id) => !remove.has(id)));
    } else {
      setSelection([...state.selected, ...filtered.map((l) => l.id).filter((id) => !selected.has(id))]);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="choose-locations">
        <h3 id="choose-locations" className="mb-3 text-base">Choose locations</h3>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orbit-muted" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search locations…" className="pl-9" aria-label="Search locations" />
          </div>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger aria-label="Filter by client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              <SelectItem value="none">Unassigned</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-orbit-heading">
            <Checkbox checked={allFilteredSelected} onCheckedChange={selectAllFiltered} disabled={!filtered.length} />
            Select all {filtered.length.toLocaleString()} shown
          </label>
          {state.selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelection([])}>
              <X /> Clear selection
            </Button>
          )}
        </div>
        <ul className="mt-3 max-h-[420px] space-y-1 overflow-y-auto rounded-2xl border border-orbit-line bg-white/60 p-1.5" aria-label="Locations">
          {filtered.length === 0 && (
            <li className="p-6 text-center text-sm text-orbit-muted">No locations of active clients match.</li>
          )}
          {filtered.slice(0, RENDER_LIMIT).map((l) => (
            <li key={l.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-orbit-primary/5',
                  selected.has(l.id) && 'bg-orbit-primary/[0.07]',
                )}
              >
                <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block wrap-anywhere text-sm font-semibold text-orbit-heading">{l.title}</span>
                  <span className="block wrap-anywhere text-xs text-orbit-muted">{[l.city, l.primary_category].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                <ClientDot client={l.client} className="hidden max-w-[140px] text-xs sm:inline-flex" />
              </label>
            </li>
          ))}
          {filtered.length > RENDER_LIMIT && (
            <li className="p-3 text-center text-xs text-orbit-muted">
              Showing the first {RENDER_LIMIT}. Search to narrow down, or use "Select all" to include every match.
            </li>
          )}
        </ul>
        {blocked.length > 0 && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowBlocked((v) => !v)} aria-expanded={showBlocked}>
              <Ban /> {showBlocked ? 'Hide' : 'Show'} {blocked.length.toLocaleString()} location{blocked.length === 1 ? '' : 's'} that can't be posted
            </Button>
            {showBlocked && (
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-dashed border-orbit-line p-1.5" aria-label="Locations that can't be posted">
                {blocked.slice(0, RENDER_LIMIT).map((l) => (
                  <li key={l.id} className="rounded-xl px-2.5 py-2">
                    <span className="block wrap-anywhere text-sm font-semibold text-orbit-muted">{l.title}</span>
                    <span className="block wrap-anywhere text-xs text-amber-700">{blockedReason.get(l.id)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="publish-as">
        <h3 id="publish-as" className="mb-1 text-base">
          Publish with <span className="text-orbit-muted">({state.selected.length} selected)</span>
        </h3>
        <p className="mb-3 text-sm text-orbit-muted">Choose which connected Gmail publishes each post.</p>
        {state.selected.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-orbit-line p-8 text-center text-sm text-orbit-muted">
            Selected locations appear here.
          </div>
        ) : (
          <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {state.selected.map((id) => {
              const loc = byId.get(id);
              if (!loc) return null;
              return (
                <li key={id} className="flex flex-col gap-2 rounded-2xl border border-orbit-line bg-white/70 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="wrap-anywhere text-sm font-bold text-orbit-heading">{loc.title}</p>
                    <p className="wrap-anywhere text-xs text-orbit-muted">{loc.city ?? loc.timezone}</p>
                  </div>
                  <Select
                    value={state.connections[id] ?? ''}
                    onValueChange={(v) => patch({ connections: { ...state.connections, [id]: v } })}
                  >
                    <SelectTrigger className="h-9 sm:w-60" aria-label={`Gmail for ${loc.title}`}>
                      <SelectValue placeholder="Choose Gmail" />
                    </SelectTrigger>
                    <SelectContent>
                      {loc.access.map((a) => (
                        <SelectItem key={a.connection_id} value={a.connection_id} disabled={a.status !== 'active'}>
                          {a.email}
                          {a.status !== 'active' ? ' (reconnect)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" onClick={() => toggle(id)} aria-label={`Remove ${loc.title}`}>
                    <X />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
