import { useMemo } from 'react';
import { CalendarClock, CalendarRange, Repeat, Rocket } from 'lucide-react';
import type { LocationDTO } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { formatInZone } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildDrafts, type ComposeState, type ScheduleMode } from './compose-state';

const HOURS = Array.from({ length: 25 }, (_, h) => h);
const hourLabel = (h: number) => (h === 24 ? '12:00 AM (end of day)' : `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`);

export function StepSchedule({
  state,
  patch,
  locById,
}: {
  state: ComposeState;
  patch: (p: Partial<ComposeState>) => void;
  locById: Map<string, LocationDTO>;
}) {
  const preview = useMemo(() => {
    if (state.scheduleMode === 'asap') return [];
    try {
      return buildDrafts(state, locById).slice(0, 8);
    } catch {
      return [];
    }
  }, [state, locById]);

  const canPublishNow = useHasRole('manager');

  return (
    <div className="grid gap-6">
      <Segmented<ScheduleMode>
        ariaLabel="When to publish"
        value={state.scheduleMode}
        onChange={(v) => patch({ scheduleMode: v })}
        options={[
          { value: 'asap', label: 'Publish ASAP', icon: Rocket },
          { value: 'specific', label: 'Specific date & time', icon: CalendarClock },
          { value: 'spread', label: 'Spread over dates', icon: CalendarRange },
        ]}
      />

      {state.scheduleMode === 'asap' && (
        <p className="text-sm text-orbit-muted">
          Posts publish on the next publisher run (every 5 minutes) once they are approved.
          {canPublishNow && ' Or click Publish now below to send them to Google straight away.'}
        </p>
      )}

      {state.scheduleMode === 'specific' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="specific-date">Date</Label>
            <Input id="specific-date" type="date" value={state.specificDate} onChange={(e) => patch({ specificDate: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="specific-time">Time</Label>
            <Input id="specific-time" type="time" value={state.specificTime} onChange={(e) => patch({ specificTime: e.target.value })} />
          </div>
          <p className="text-xs text-orbit-muted sm:col-span-2">Each post goes out at this time in its location's own time zone.</p>
        </div>
      )}

      {state.scheduleMode === 'spread' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="spread-start">From date</Label>
            <Input id="spread-start" type="date" value={state.spreadStart} onChange={(e) => patch({ spreadStart: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="spread-end">To date</Label>
            <Input id="spread-end" type="date" value={state.spreadEnd} onChange={(e) => patch({ spreadEnd: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="spread-from">Between</Label>
            <Select value={String(state.spreadFromHour)} onValueChange={(v) => patch({ spreadFromHour: Number(v) })}>
              <SelectTrigger id="spread-from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.slice(0, 24).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {hourLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="spread-to">And</Label>
            <Select value={String(state.spreadToHour)} onValueChange={(v) => patch({ spreadToHour: Number(v) })}>
              <SelectTrigger id="spread-to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.slice(1).map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {hourLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-orbit-muted sm:col-span-2">
            Posts are distributed evenly across the days and hours, in each location's own time zone.
          </p>
        </div>
      )}

      <div className="grid gap-3 rounded-3xl border border-orbit-line bg-white/60 p-4 sm:grid-cols-2 sm:p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="repeat" className="flex items-center gap-1.5">
            <Repeat className="h-4 w-4 text-orbit-primary" aria-hidden /> Repeat weekly
          </Label>
          <Select value={String(state.repeatWeeks)} onValueChange={(v) => patch({ repeatWeeks: Number(v) })}>
            <SelectTrigger id="repeat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Don't repeat</SelectItem>
              {[2, 3, 4, 6, 8, 12].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} weeks in total
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.repeatWeeks > 1 && (
            <p className="text-xs text-orbit-muted">
              Creates {state.repeatWeeks} posts per location, one week apart. Auto images pick a fresh library image each time.
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input id="campaign-name" value={state.campaignName} onChange={(e) => patch({ campaignName: e.target.value })} />
        </div>
      </div>

      {preview.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-orbit-heading">Schedule preview</h4>
          <ul className="divide-y divide-orbit-line rounded-2xl border border-orbit-line bg-white/70">
            {preview.map((d) => {
              const loc = locById.get(d.location_id);
              return (
                <li key={d.location_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="wrap-anywhere font-semibold text-orbit-heading">{loc?.title}</span>
                  <span className="text-orbit-muted">
                    {loc && d.scheduled_at ? `${formatInZone(d.scheduled_at, loc.timezone)} (${loc.timezone})` : 'ASAP'}
                  </span>
                </li>
              );
            })}
          </ul>
          {state.selected.length > preview.length && (
            <p className="mt-1.5 text-xs text-orbit-muted">…and {state.selected.length - preview.length} more.</p>
          )}
        </div>
      )}
    </div>
  );
}
