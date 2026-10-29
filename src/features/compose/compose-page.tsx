import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CheckCheck, Loader2, MapPin, Save, Send, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { CreatePostsInput, PostSubmitMode } from '../../../shared/schemas';
import type { AppSettings, CreatePostsResult } from '../../../shared/types';
import { useHasRole } from '@/app/auth';
import { api, errorMessage } from '@/lib/api';
import { formatInZone } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { useClients, useLocationOptions } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/app/error-state';
import { PostPreview } from '@/components/app/post-preview';
import { PageHeader } from '@/components/layout/page-header';
import { PageSkeleton } from '@/components/page-skeleton';
import { Button, ButtonChip } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  buildDrafts,
  defaultCampaignName,
  defaultConnectionFor,
  initialComposeState,
  summaryFor,
  validateCompose,
  type ComposeState,
} from './compose-state';
import { StepContent } from './step-content';
import { StepDetails } from './step-details';
import { StepLocations } from './step-locations';
import { StepSchedule } from './step-schedule';

const STEPS = ['Locations', 'Details', 'Content', 'Schedule'];

export function ComposePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const canApprove = useHasRole('manager');
  const locationsQuery = useLocationOptions();
  const { data: clients = [] } = useClients();
  const { data: settings } = useQuery({ queryKey: qk.settings, queryFn: () => api.get<AppSettings>('/settings') });

  const [state, setState] = useState<ComposeState>(initialComposeState);
  const [step, setStep] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const patch = (p: Partial<ComposeState>) => setState((s) => ({ ...s, ...p }));

  const locations = locationsQuery.data ?? [];
  const locById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // Prefill from ?locations=id1,id2 (e.g. "Compose post" on a location).
  useEffect(() => {
    const ids = params.get('locations')?.split(',').filter((id) => locById.has(id)) ?? [];
    if (!ids.length || state.selected.length) return;
    const connections: Record<string, string> = {};
    ids.forEach((id) => {
      const c = defaultConnectionFor(locById.get(id)!);
      if (c) connections[id] = c;
    });
    patch({ selected: ids, connections });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locById, params]);

  const problem = validateCompose(state, locById);
  const canPublishNow = canApprove && state.scheduleMode === 'asap';
  const selectedClients = new Set(state.selected.map((id) => locById.get(id)?.client?.id ?? null));
  const sharedClientId = selectedClients.size === 1 ? ([...selectedClients][0] ?? null) : null;
  const stepBlocked = (s: number) => !!problem && problem.step <= s;

  const submit = useMutation({
    mutationFn: (mode: PostSubmitMode) => {
      const body: CreatePostsInput = {
        campaign: {
          name: state.campaignName.trim() || defaultCampaignName(state.selected.length),
          base_prompt: state.contentMode === 'ai' ? state.brief : null,
        },
        mode,
        repeatWeeks: state.repeatWeeks,
        posts: buildDrafts(state, locById),
      };
      return api.post<CreatePostsResult>('/posts', body);
    },
    onSuccess: (r) => {
      if (r.publish) {
        const { published, failed, queued } = r.publish;
        const parts = [`${published} published`];
        if (failed) parts.push(`${failed} failed`);
        if (queued) parts.push(`${queued} still in the queue (they go out within 5 minutes)`);
        (failed ? toast.warning : toast.success)(`Publish now: ${parts.join(', ')}`, {
          description: failed ? 'Open the Queue to see why; temporary errors are retried automatically.' : undefined,
        });
        navigate('/queue');
        return;
      }
      const label =
        r.status === 'draft' ? 'saved as drafts' : r.status === 'pending_approval' ? 'submitted for approval' : 'scheduled';
      toast.success(`${r.created} post${r.created === 1 ? '' : 's'} ${label}`);
      navigate(r.status === 'pending_approval' && canApprove ? '/approvals' : '/queue');
    },
    onError: (err) => toast.error('Could not create posts', { description: errorMessage(err) }),
  });

  if (locationsQuery.isLoading) return <PageSkeleton />;
  if (locationsQuery.error) {
    return (
      <Card>
        <ErrorState error={locationsQuery.error} onRetry={() => void locationsQuery.refetch()} />
      </Card>
    );
  }
  if (!locations.length) {
    return (
      <>
        <PageHeader eyebrow="Create" title="Compose a Post" highlight="Post" />
        <Card>
          <EmptyState
            icon={MapPin}
            title="No active locations yet"
            description="Connect a Google account and sync its Business Profiles before composing posts."
            action={
              <Button asChild>
                <Link to="/connections">Go to Connections</Link>
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const previewLocId = previewId && state.selected.includes(previewId) ? previewId : state.selected[0];
  const previewLoc = previewLocId ? locById.get(previewLocId) : undefined;
  const firstDraft = previewLoc ? buildDrafts({ ...state, selected: [previewLoc.id] }, locById)[0] : undefined;
  const approvalRequired = settings?.approval_required ?? true;

  const goNext = () => {
    if (stepBlocked(step)) {
      toast.error(problem!.message);
      return;
    }
    if (step === 2 && !state.campaignName) patch({ campaignName: defaultCampaignName(state.selected.length) });
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader
        eyebrow="Create"
        title="Compose a Post"
        highlight="Post"
        description="Write once or generate a unique variation for every location, then schedule it."
      />

      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          const reachable = i <= step || !stepBlocked(i - 1);
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => reachable && setStep(i)}
                disabled={!reachable}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-2 rounded-full border px-2 py-2 text-left text-xs font-bold transition sm:px-3 sm:text-sm',
                  current
                    ? 'border-transparent bg-orbit-gradient text-white shadow-glow'
                    : done
                      ? 'border-orbit-primary/30 bg-white text-orbit-primary'
                      : 'border-orbit-line bg-white/60 text-orbit-muted',
                  !reachable && 'cursor-not-allowed opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
                    current ? 'bg-white text-orbit-primary' : done ? 'bg-orbit-gradient text-white' : 'bg-orbit-primary/10',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="hidden truncate sm:inline">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-4 sm:p-6">
          {step === 0 && <StepLocations state={state} patch={patch} locations={locations} clients={clients} />}
          {step === 1 && <StepDetails state={state} patch={patch} clientId={sharedClientId} />}
          {step === 2 && <StepContent state={state} patch={patch} locById={locById} />}
          {step === 3 && <StepSchedule state={state} patch={patch} locById={locById} />}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-orbit-line pt-5 sm:flex-row sm:items-center">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft /> Back
              </Button>
            )}
            {problem && problem.step <= step && <p className="text-sm font-medium text-amber-700 sm:mr-auto sm:pl-2">{problem.message}</p>}
            <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
              {step < STEPS.length - 1 ? (
                <Button onClick={goNext}>
                  Next: {STEPS[step + 1]}
                  <ButtonChip>
                    <ArrowRight />
                  </ButtonChip>
                </Button>
              ) : (
                <>
                  <Button variant="outline" disabled={submit.isPending || !!problem} onClick={() => submit.mutate('draft')}>
                    <Save /> Save draft
                  </Button>
                  <Button
                    variant={canApprove ? 'secondary' : 'default'}
                    disabled={submit.isPending || !!problem}
                    onClick={() => submit.mutate('submit')}
                  >
                    {submit.isPending && submit.variables === 'submit' ? <Loader2 className="animate-spin" /> : <Send />}
                    {approvalRequired ? 'Submit for approval' : 'Schedule'}
                  </Button>
                  {canApprove && approvalRequired && (
                    <Button
                      variant={canPublishNow ? 'secondary' : 'default'}
                      disabled={submit.isPending || !!problem}
                      onClick={() => submit.mutate('approve')}
                    >
                      {submit.isPending && submit.variables === 'approve' ? <Loader2 className="animate-spin" /> : <CheckCheck />}
                      Approve &amp; schedule
                    </Button>
                  )}
                  {canPublishNow && (
                    <Button
                      disabled={submit.isPending || !!problem}
                      onClick={() => submit.mutate('publish_now')}
                      title="Approve and publish to Google right away"
                    >
                      {submit.isPending && submit.variables === 'publish_now' ? <Loader2 className="animate-spin" /> : <Zap />}
                      {submit.isPending && submit.variables === 'publish_now' ? 'Publishing…' : 'Publish now'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Preview">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-base">Preview</h3>
            {state.selected.length > 1 && (
              <Select value={previewLocId} onValueChange={setPreviewId}>
                <SelectTrigger className="h-9 w-56" aria-label="Preview location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.selected.map((id) => (
                    <SelectItem key={id} value={id}>
                      {locById.get(id)?.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <PostPreview
            businessName={previewLoc?.title ?? 'Select a location'}
            topicType={state.topicType}
            summary={previewLoc ? summaryFor(state, previewLoc.id) : state.singleText}
            imageMode={state.imageChoice === 'upload' || state.imageChoice === 'library' ? 'image' : state.imageChoice}
            imageUrl={state.imageChoice === 'library' ? state.libraryImage?.public_url : state.upload?.url}
            ctaType={state.ctaType === 'NONE' ? null : state.ctaType}
            eventTitle={state.eventTitle}
            eventRange={
              previewLoc && firstDraft?.event_start && firstDraft.event_end
                ? `${formatInZone(firstDraft.event_start, previewLoc.timezone, 'MMM d, h:mm a')} – ${formatInZone(firstDraft.event_end, previewLoc.timezone, 'MMM d, h:mm a')}`
                : null
            }
            couponCode={state.couponCode}
            whenLabel={
              previewLoc && firstDraft?.scheduled_at
                ? `Scheduled · ${formatInZone(firstDraft.scheduled_at, previewLoc.timezone, 'MMM d, h:mm a')}`
                : 'Just now'
            }
          />
        </aside>
      </div>
    </>
  );
}
