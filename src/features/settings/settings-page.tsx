import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { SettingsUpdate } from '../../../shared/schemas';
import { ROLES, type AppSettings, type PublisherSummary, type Role, type TeamMemberDTO } from '../../../shared/types';
import { useMe } from '@/app/auth';
import { api, errorMessage } from '@/lib/api';
import { formatLocal, initials, timeAgo } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { ErrorState } from '@/components/app/error-state';
import { TimezoneSelect } from '@/components/app/timezone-select';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

const ROLE_HELP: Record<Role, string> = {
  writer: 'Compose and edit drafts, submit for approval, import sheets.',
  manager: 'Everything a writer can do, plus approve, schedule, retry, manage locations, clients and libraries.',
  admin: 'Everything, plus Google connections, settings, team roles and deleting published posts.',
};

export function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" highlight="Settings" description="Approval rules, publisher limits and team roles." />
      <div className="grid gap-6 xl:grid-cols-2">
        <PublishingSettings />
        <PublisherRunner />
        <div className="xl:col-span-2">
          <TeamRoles />
        </div>
      </div>
    </>
  );
}

function PublishingSettings() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: qk.settings, queryFn: () => api.get<AppSettings>('/settings') });
  const [draft, setDraft] = useState<AppSettings | null>(null);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);
  const save = useMutation({
    mutationFn: (patch: SettingsUpdate) => api.patch<AppSettings>('/settings', patch),
    onSuccess: (s) => {
      qc.setQueryData(qk.settings, s);
      toast.success('Settings saved');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const dirty = !!data && !!draft && JSON.stringify(data) !== JSON.stringify(draft);
  const validNumbers = !!draft && draft.max_posts_per_run >= 1 && draft.max_posts_per_run <= 50 && draft.publish_spacing_seconds >= 0 && draft.publish_spacing_seconds <= 30;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-orbit-primary" aria-hidden /> Publishing
        </CardTitle>
        <CardDescription>How posts move from compose to Google.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !draft ? (
          error ? <ErrorState error={error} onRetry={() => void refetch()} /> : <Skeleton className="h-56" />
        ) : (
          <div className="grid gap-5">
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-orbit-line bg-white/70 px-4 py-3">
              <div>
                <Label htmlFor="approval">Require approval</Label>
                <p className="text-xs text-orbit-muted">When on, new posts wait in Approvals until a manager approves them.</p>
              </div>
              <Switch id="approval" checked={draft.approval_required} onCheckedChange={(v) => setDraft({ ...draft, approval_required: v })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="max-posts">Max posts per publisher run</Label>
                <Input id="max-posts" type="number" min={1} max={50} value={draft.max_posts_per_run} onChange={(e) => setDraft({ ...draft, max_posts_per_run: Number(e.target.value) })} />
                <p className="text-xs text-orbit-muted">The publisher runs every 5 minutes. 1–50.</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="spacing">Seconds between posts</Label>
                <Input id="spacing" type="number" min={0} max={30} value={draft.publish_spacing_seconds} onChange={(e) => setDraft({ ...draft, publish_spacing_seconds: Number(e.target.value) })} />
                <p className="text-xs text-orbit-muted">Spacing keeps API usage gentle. 0–30.</p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="default-tz">Default time zone for new locations</Label>
              <TimezoneSelect id="default-tz" value={draft.default_timezone} onChange={(tz) => setDraft({ ...draft, default_timezone: tz })} />
            </div>
            <Button className="justify-self-start" disabled={!dirty || !validNumbers || save.isPending} onClick={() => save.mutate(draft)}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PublisherRunner() {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: () => api.post<PublisherSummary>('/publisher/run'),
    onSuccess: (s) => {
      toast.success(`Publisher finished: ${s.published} published, ${s.failed} failed`);
      void qc.invalidateQueries({ queryKey: qk.postsAll });
      void qc.invalidateQueries({ queryKey: qk.notificationsAll });
    },
    onError: (err) => toast.error('Publisher failed', { description: errorMessage(err) }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-orbit-primary" aria-hidden /> Publisher
        </CardTitle>
        <CardDescription>Runs automatically every 5 minutes. Run it now to publish everything that is due immediately.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Button className="justify-self-start" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? <Loader2 className="animate-spin" /> : <Play />}
          {run.isPending ? 'Publishing…' : 'Run publisher now'}
        </Button>
        {run.data && (
          <div>
            <div className="mb-3 grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ['Processed', run.data.processed],
                  ['Published', run.data.published],
                  ['Failed', run.data.failed],
                  ['Still due', run.data.remaining],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-orbit-line bg-white/70 p-2">
                  <p className="text-xl font-extrabold text-orbit-heading">{value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-orbit-muted">{label}</p>
                </div>
              ))}
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-orbit-heading p-4 text-xs text-white">{JSON.stringify(run.data, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamRoles() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const team = useQuery({ queryKey: ['team'], queryFn: () => api.get<TeamMemberDTO[]>('/team') });
  const change = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch<TeamMemberDTO>(`/team/${id}`, { role }),
    onSuccess: (u) => {
      qc.setQueryData<TeamMemberDTO[]>(['team'], (old) => old?.map((m) => (m.id === u.id ? u : m)));
      if (u.id === me?.id) void qc.invalidateQueries({ queryKey: qk.me });
      toast.success(`${u.name ?? u.email} is now ${u.role}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orbit-primary" aria-hidden /> Team roles
          </CardTitle>
          <CardDescription>Invite people from your Clerk dashboard; set their role here.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void team.refetch()} disabled={team.isFetching}>
          <RefreshCw className={team.isFetching ? 'animate-spin' : undefined} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="mb-5 grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r} className="rounded-2xl border border-orbit-line bg-white/70 p-3">
              <p className="text-sm font-bold capitalize text-orbit-heading">{r}</p>
              <p className="text-xs text-orbit-muted">{ROLE_HELP[r]}</p>
            </li>
          ))}
        </ul>
        {team.isLoading ? (
          <Skeleton className="h-40" />
        ) : team.error ? (
          <ErrorState error={team.error} onRetry={() => void team.refetch()} />
        ) : (
          <ul className="divide-y divide-orbit-line">
            {team.data?.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar>
                  {u.image_url && <AvatarImage src={u.image_url} alt="" />}
                  <AvatarFallback>{initials(u.name ?? u.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="wrap-anywhere text-sm font-bold text-orbit-heading">
                    {u.name ?? u.email}
                    {u.id === me?.id && <span className="ml-1.5 text-xs font-medium text-orbit-muted">(you)</span>}
                  </p>
                  <p className="wrap-anywhere text-xs text-orbit-muted" title={u.last_sign_in_at ? formatLocal(u.last_sign_in_at) : undefined}>
                    {u.email} · {u.last_sign_in_at ? `last seen ${timeAgo(u.last_sign_in_at)}` : 'never signed in'}
                  </p>
                </div>
                <Select value={u.role} onValueChange={(v) => change.mutate({ id: u.id, role: v as Role })} disabled={change.isPending}>
                  <SelectTrigger className="w-36" aria-label={`Role for ${u.name ?? u.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        <span className="capitalize">{r}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
