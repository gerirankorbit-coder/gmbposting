import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, RefreshCw, Save, ShieldCheck, UserPlus, Users, UserX, X } from 'lucide-react';
import { toast } from 'sonner';
import type { InviteInput, SettingsUpdate } from '../../../shared/schemas';
import { ROLES, type AppSettings, type InvitationDTO, type Role, type TeamMemberDTO } from '../../../shared/types';
import { useMe } from '@/app/auth';
import { api, errorMessage } from '@/lib/api';
import { formatLocal, initials, timeAgo } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { ErrorState } from '@/components/app/error-state';
import { TimezoneSelect } from '@/components/app/timezone-select';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
      <PageHeader eyebrow="Admin" title="Settings" highlight="Settings" description="Approval rules, publisher limits and team access." />
      <div className="grid gap-6">
        <PublishingSettings />
        <TeamRoles />
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

function TeamRoles() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const team = useQuery({ queryKey: ['team'], queryFn: () => api.get<TeamMemberDTO[]>('/team') });
  const invites = useQuery({ queryKey: ['team', 'invitations'], queryFn: () => api.get<InvitationDTO[]>('/team/invitations') });
  const refreshAll = () => void qc.invalidateQueries({ queryKey: ['team'] });

  const change = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch<TeamMemberDTO>(`/team/${id}`, { role }),
    onSuccess: (u) => {
      qc.setQueryData<TeamMemberDTO[]>(['team'], (old) => old?.map((m) => (m.id === u.id ? u : m)));
      if (u.id === me?.id) void qc.invalidateQueries({ queryKey: qk.me });
      toast.success(`${u.name ?? u.email} is now ${u.role}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const removeAccess = useMutation({
    mutationFn: (id: string) => api.delete<TeamMemberDTO>(`/team/${id}/access`),
    onSuccess: (u) => {
      qc.setQueryData<TeamMemberDTO[]>(['team'], (old) => old?.map((m) => (m.id === u.id ? u : m)));
      toast.success(`Removed access for ${u.name ?? u.email}`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/team/invitations/${id}`),
    onSuccess: () => {
      refreshAll();
      toast.success('Invitation revoked');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orbit-primary" aria-hidden /> Team access
          </CardTitle>
          <CardDescription>Only people you invite can use OrbitPost. Invite by email and pick their role.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshAll} disabled={team.isFetching || invites.isFetching}>
          <RefreshCw className={team.isFetching || invites.isFetching ? 'animate-spin' : undefined} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <InviteForm onDone={refreshAll} />

        <ul className="mb-5 grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r} className="rounded-2xl border border-orbit-line bg-white/70 p-3">
              <p className="text-sm font-bold capitalize text-orbit-heading">{r}</p>
              <p className="text-xs text-orbit-muted">{ROLE_HELP[r]}</p>
            </li>
          ))}
        </ul>

        {!!invites.data?.length && (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-bold text-orbit-heading">Pending invitations</h3>
            <ul className="divide-y divide-orbit-line rounded-2xl border border-orbit-line bg-white/60 px-4">
              {invites.data.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-orbit-primary" aria-hidden />
                  <div className="min-w-[12rem] flex-1">
                    <p className="wrap-anywhere text-sm font-semibold text-orbit-heading">{i.email}</p>
                    <p className="text-xs text-orbit-muted">Invited {timeAgo(i.created_at)} · waiting for sign-up</p>
                  </div>
                  {i.role && <Badge variant="outline" className="capitalize">{i.role}</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => revoke.mutate(i.id)} disabled={revoke.isPending}>
                    <X /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

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
                <div className="min-w-[12rem] flex-1">
                  <p className="wrap-anywhere text-sm font-bold text-orbit-heading">
                    {u.name ?? u.email}
                    {u.id === me?.id && <span className="ml-1.5 text-xs font-medium text-orbit-muted">(you)</span>}
                    {!u.role && (
                      <Badge variant="amber" className="ml-2 align-middle">
                        No access
                      </Badge>
                    )}
                  </p>
                  <p className="wrap-anywhere text-xs text-orbit-muted" title={u.last_sign_in_at ? formatLocal(u.last_sign_in_at) : undefined}>
                    {u.email} · {u.last_sign_in_at ? `last seen ${timeAgo(u.last_sign_in_at)}` : 'never signed in'}
                  </p>
                </div>
                <Select value={u.role ?? undefined} onValueChange={(v) => change.mutate({ id: u.id, role: v as Role })} disabled={change.isPending}>
                  <SelectTrigger className="w-40" aria-label={`Role for ${u.name ?? u.email}`}>
                    <SelectValue placeholder="Give access…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        <span className="capitalize">{r}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {u.role && u.id !== me?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => {
                      if (window.confirm(`Remove access for ${u.name ?? u.email}? They will be signed out of OrbitPost.`)) removeAccess.mutate(u.id);
                    }}
                    disabled={removeAccess.isPending}
                  >
                    <UserX /> Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('writer');
  const invite = useMutation({
    mutationFn: (body: InviteInput) => api.post<{ granted: boolean; email: string; role: Role }>('/team/invitations', body),
    onSuccess: (r) => {
      toast.success(r.granted ? `${r.email} now has ${r.role} access` : `Invitation sent to ${r.email}`, {
        description: r.granted ? undefined : 'They get an email with a sign-up link. Only that email address can use it.',
      });
      setEmail('');
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  return (
    <form
      className="mb-5 grid gap-3 rounded-2xl border border-orbit-line bg-white/70 p-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) invite.mutate({ email: email.trim(), role });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="invite-email">Email to invite</Label>
        <Input id="invite-email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger id="invite-role">
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
      </div>
      <Button type="submit" disabled={!valid || invite.isPending}>
        {invite.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} Send invite
      </Button>
    </form>
  );
}
