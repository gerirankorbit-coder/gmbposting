import { useState } from 'react';
import { AlertTriangle, Loader2, PenLine, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { contentWarnings } from '../../../shared/content';
import { AI_MAX_LOCATIONS_PER_REQUEST, type AiVariationsInput } from '../../../shared/schemas';
import type { LocationDTO, VariationDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { CharCounter } from '@/components/app/char-counter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ComposeState, ContentMode } from './compose-state';

const TONES = [
  'friendly and professional',
  'warm and local',
  'enthusiastic',
  'informative and expert',
  'calm and reassuring',
  'playful',
];

function Warnings({ text }: { text: string }) {
  const warnings = contentWarnings(text);
  if (!warnings.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {warnings.map((w) => (
        <li key={w} className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {w}
        </li>
      ))}
    </ul>
  );
}

export function StepContent({
  state,
  patch,
  locById,
}: {
  state: ComposeState;
  patch: (p: Partial<ComposeState>) => void;
  locById: Map<string, LocationDTO>;
}) {
  const [busyAll, setBusyAll] = useState(false);
  const [busyOne, setBusyOne] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const request = (locationIds: string[], avoid?: string[]): Promise<VariationDTO[]> => {
    const body: AiVariationsInput = {
      brief: state.brief,
      topicType: state.topicType,
      tone: state.tone,
      ctaType: state.ctaType === 'NONE' ? null : state.ctaType,
      locationIds,
      avoid,
    };
    return api.post<VariationDTO[]>('/ai/variations', body);
  };

  const generateAll = async () => {
    if (state.brief.trim().length < 10) {
      toast.error('Describe the post in a sentence or two first.');
      return;
    }
    setBusyAll(true);
    const ids = state.selected;
    setProgress({ done: 0, total: ids.length });
    const next: Record<string, string> = { ...state.variations };
    try {
      for (let i = 0; i < ids.length; i += AI_MAX_LOCATIONS_PER_REQUEST) {
        const result = await request(ids.slice(i, i + AI_MAX_LOCATIONS_PER_REQUEST));
        result.forEach((v) => (next[v.location_id] = v.summary));
        patch({ variations: { ...next } });
        setProgress({ done: Math.min(ids.length, i + AI_MAX_LOCATIONS_PER_REQUEST), total: ids.length });
      }
      toast.success(`Generated ${ids.length} unique post${ids.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error('AI generation failed', { description: errorMessage(err) });
    } finally {
      setBusyAll(false);
      setProgress(null);
    }
  };

  const regenerateOne = async (id: string) => {
    if (state.brief.trim().length < 10) {
      toast.error('Describe the post in a sentence or two first.');
      return;
    }
    setBusyOne(id);
    try {
      const avoid = [state.variations[id], ...state.selected.filter((s) => s !== id).map((s) => state.variations[s])]
        .filter((t): t is string => !!t)
        .slice(0, 10);
      const [v] = await request([id], avoid);
      if (v) patch({ variations: { ...state.variations, [id]: v.summary } });
    } catch (err) {
      toast.error('Could not regenerate', { description: errorMessage(err) });
    } finally {
      setBusyOne(null);
    }
  };

  const hasVariations = state.selected.some((id) => state.variations[id]);

  return (
    <div className="grid gap-6">
      <Segmented<ContentMode>
        ariaLabel="How to write the content"
        value={state.contentMode}
        onChange={(v) => patch({ contentMode: v })}
        options={[
          { value: 'single', label: 'One text for all', icon: PenLine },
          { value: 'ai', label: 'Unique variations with AI', icon: Sparkles },
        ]}
      />

      {state.contentMode === 'single' ? (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="single-text">Post text</Label>
            <CharCounter length={state.singleText.length} />
          </div>
          <Textarea
            id="single-text"
            rows={10}
            value={state.singleText}
            onChange={(e) => patch({ singleText: e.target.value })}
            placeholder="Write your update…"
          />
          <Warnings text={state.singleText} />
          {state.selected.length > 1 && (
            <p className="text-xs text-orbit-muted">
              The same text goes to all {state.selected.length} locations. For better results on Google,
              generate unique variations instead.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 rounded-3xl border border-orbit-line bg-white/60 p-4 sm:p-5">
            <div className="grid gap-1.5">
              <Label htmlFor="brief">Brief</Label>
              <Textarea
                id="brief"
                rows={4}
                value={state.brief}
                onChange={(e) => patch({ brief: e.target.value })}
                placeholder="What should the posts be about? e.g. Winter roof inspections: why ice dams form, 3 warning signs, book a free inspection before the first snow."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="tone">Tone</Label>
                <Select value={TONES.includes(state.tone) ? state.tone : 'custom'} onValueChange={(v) => patch({ tone: v === 'custom' ? '' : v })}>
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t[0]!.toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {!TONES.includes(state.tone) && (
                  <Input aria-label="Custom tone" value={state.tone} onChange={(e) => patch({ tone: e.target.value })} placeholder="Describe the tone" />
                )}
              </div>
              <Button onClick={generateAll} disabled={busyAll || !state.selected.length}>
                {busyAll ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {hasVariations ? 'Regenerate all' : `Generate ${state.selected.length} variation${state.selected.length === 1 ? '' : 's'}`}
              </Button>
            </div>
            {progress && (
              <div role="status" className="grid gap-1.5">
                <div className="h-2 overflow-hidden rounded-full bg-orbit-primary/10">
                  <div className="h-full rounded-full bg-orbit-gradient transition-all" style={{ width: `${Math.max(6, (progress.done / progress.total) * 100)}%` }} />
                </div>
                <p className="text-xs text-orbit-muted">
                  Writing posts… {progress.done} of {progress.total} done
                </p>
              </div>
            )}
          </div>

          <ul className="grid gap-4">
            {state.selected.map((id) => {
              const loc = locById.get(id);
              const text = state.variations[id] ?? '';
              return (
                <li key={id} className="rounded-3xl border border-orbit-line bg-white/70 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="wrap-anywhere text-sm font-bold text-orbit-heading">{loc?.title}</p>
                      <p className="wrap-anywhere text-xs text-orbit-muted">{[loc?.city, loc?.primary_category].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CharCounter length={text.length} />
                      <Button variant="outline" size="sm" onClick={() => regenerateOne(id)} disabled={busyAll || busyOne === id}>
                        {busyOne === id ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                        {text ? 'Regenerate' : 'Generate'}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    aria-label={`Post text for ${loc?.title ?? 'location'}`}
                    rows={7}
                    value={text}
                    onChange={(e) => patch({ variations: { ...state.variations, [id]: e.target.value } })}
                    placeholder="Generate with AI or write this location's post."
                  />
                  <Warnings text={text} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
