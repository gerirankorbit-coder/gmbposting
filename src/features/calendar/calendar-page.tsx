import { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PostListItemDTO } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { api, errorMessage } from '@/lib/api';
import { useClients } from '@/lib/queries';
import { qk } from '@/lib/query-keys';
import { ErrorState } from '@/components/app/error-state';
import { POST_STATUS_META } from '@/components/app/status-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePostUi } from '@/features/posts/post-actions';
import { useReschedulePost } from '@/features/posts/use-post-actions';

const ALL = 'all';
const FALLBACK_COLOR = '#8B2CF5';

function EventChip({ arg }: { arg: EventContentArg }) {
  const post = arg.event.extendedProps.post as PostListItemDTO;
  const meta = POST_STATUS_META[post.status];
  const Icon = meta.icon;
  const color = post.location?.client?.color ?? FALLBACK_COLOR;
  return (
    <div
      className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-lg px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-orbit-heading"
      style={{ backgroundColor: `${color}1f`, borderLeft: `3px solid ${color}` }}
      title={`${post.location?.title ?? ''} · ${meta.label}`}
    >
      <Icon className={`h-3 w-3 shrink-0 ${post.status === 'failed' ? 'text-rose-600' : post.status === 'published' ? 'text-emerald-600' : 'text-orbit-primary'}`} aria-hidden />
      {arg.timeText && <span className="shrink-0 text-orbit-muted">{arg.timeText}</span>}
      <span className="truncate">{post.location?.title}</span>
    </div>
  );
}

export function CalendarPage() {
  const canReschedule = useHasRole('manager');
  const ui = usePostUi();
  const reschedule = useReschedulePost();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState(ALL);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const query = range ? { ...range, clientId: clientId === ALL ? undefined : clientId } : null;
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: qk.postCalendar(query ?? {}),
    queryFn: () => api.get<PostListItemDTO[]>('/posts/calendar', query!),
    enabled: !!query,
    placeholderData: keepPreviousData,
  });

  const events = useMemo<EventInput[]>(
    () =>
      (data ?? []).map((p) => ({
        id: p.id,
        start: p.published_at ?? p.scheduled_at ?? undefined,
        allDay: false,
        editable: canReschedule && p.status === 'scheduled',
        extendedProps: { post: p },
      })),
    [data, canReschedule],
  );

  const onDatesSet = (arg: DatesSetArg) => {
    const next = { from: arg.start.toISOString(), to: arg.end.toISOString() };
    setRange((r) => (r?.from === next.from && r.to === next.to ? r : next));
  };

  const onDrop = (arg: EventDropArg) => {
    const post = arg.event.extendedProps.post as PostListItemDTO;
    if (!arg.event.start) return arg.revert();
    if (arg.event.start < new Date()) {
      toast.error('Pick a time in the future.');
      return arg.revert();
    }
    reschedule.mutate(
      { id: post.id, scheduled_at: arg.event.start.toISOString() },
      {
        onError: (err) => {
          arg.revert();
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Posting Calendar"
        highlight="Calendar"
        description="Scheduled and published posts, colour-coded by client. Drag a scheduled post to move it."
        actions={
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-56" aria-label="Filter by client">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Card className="orbit-calendar relative p-3 sm:p-5">
        {isFetching && (
          <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-1.5 text-xs font-semibold text-orbit-primary" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
          </span>
        )}
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={typeof window !== 'undefined' && window.innerWidth < 640 ? 'timeGridDay' : 'dayGridMonth'}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
            height="auto"
            dayMaxEvents={4}
            nowIndicator
            events={events}
            eventDurationEditable={false}
            eventContent={(arg) => <EventChip arg={arg} />}
            eventClick={(arg) => {
              arg.jsEvent.preventDefault();
              ui.openDrawer(arg.event.extendedProps.post as PostListItemDTO);
            }}
            eventDrop={onDrop}
            datesSet={onDatesSet}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
          />
        )}
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-orbit-muted" aria-label="Legend">
          {(['scheduled', 'pending_approval', 'published', 'failed'] as const).map((s) => {
            const m = POST_STATUS_META[s];
            return (
              <li key={s} className="flex items-center gap-1.5">
                <m.icon className="h-3.5 w-3.5" aria-hidden /> {m.label}
              </li>
            );
          })}
          <li>Times shown in your local time zone.</li>
        </ul>
      </Card>
      {ui.elements}
    </>
  );
}
