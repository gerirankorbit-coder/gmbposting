import { useRef, useState } from 'react';
import { CalendarDays, ImageIcon, ImageOff, Images, Loader2, Megaphone, Sparkles, Tag, Trash2, Upload } from 'lucide-react';
import { LibraryPicker } from './library-picker';
import { toast } from 'sonner';
import { CTA_TYPES, type CtaType, type TopicType } from '../../../shared/types';
import { errorMessage } from '@/lib/api';
import { IMAGE_ACCEPT, uploadImage } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ComposeState, ImageChoice } from './compose-state';

export const CTA_LABELS: Record<CtaType, string> = {
  BOOK: 'Book',
  ORDER: 'Order online',
  SHOP: 'Buy',
  LEARN_MORE: 'Learn more',
  SIGN_UP: 'Sign up',
  CALL: 'Call now',
};

export function StepDetails({ state, patch, clientId }: { state: ComposeState; patch: (p: Partial<ComposeState>) => void; clientId: string | null }) {
  const eventLike = state.topicType !== 'STANDARD';
  return (
    <div className="grid gap-7">
      <section className="grid gap-3">
        <h3 className="text-base">Post type</h3>
        <Segmented<TopicType>
          ariaLabel="Post type"
          value={state.topicType}
          onChange={(v) => patch({ topicType: v })}
          options={[
            { value: 'STANDARD', label: 'Update', icon: Megaphone },
            { value: 'OFFER', label: 'Offer', icon: Tag },
            { value: 'EVENT', label: 'Event', icon: CalendarDays },
          ]}
        />
      </section>

      {eventLike && (
        <section className="grid gap-4 rounded-3xl border border-orbit-line bg-white/60 p-4 sm:p-5">
          <div className="grid gap-1.5">
            <Label htmlFor="event-title">{state.topicType === 'OFFER' ? 'Offer title' : 'Event title'}</Label>
            <Input
              id="event-title"
              maxLength={58}
              value={state.eventTitle}
              onChange={(e) => patch({ eventTitle: e.target.value })}
              placeholder={state.topicType === 'OFFER' ? '15% off spring cleaning' : 'Open house weekend'}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Starts</Label>
              <div className="flex gap-2">
                <Input type="date" aria-label="Start date" value={state.eventStartDate} onChange={(e) => patch({ eventStartDate: e.target.value })} />
                <Input type="time" aria-label="Start time" className="w-32" value={state.eventStartTime} onChange={(e) => patch({ eventStartTime: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Ends</Label>
              <div className="flex gap-2">
                <Input type="date" aria-label="End date" value={state.eventEndDate} onChange={(e) => patch({ eventEndDate: e.target.value })} />
                <Input type="time" aria-label="End time" className="w-32" value={state.eventEndTime} onChange={(e) => patch({ eventEndTime: e.target.value })} />
              </div>
            </div>
          </div>
          <p className="-mt-2 text-xs text-orbit-muted">Dates and times are in each location's own time zone.</p>
          {state.topicType === 'OFFER' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="coupon">Coupon code (optional)</Label>
                <Input id="coupon" maxLength={58} value={state.couponCode} onChange={(e) => patch({ couponCode: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="redeem">Redeem online URL (optional)</Label>
                <Input id="redeem" type="url" value={state.redeemUrl} onChange={(e) => patch({ redeemUrl: e.target.value })} placeholder="https://" />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="terms">Terms and conditions (optional)</Label>
                <Textarea id="terms" rows={2} value={state.terms} onChange={(e) => patch({ terms: e.target.value })} />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3">
        <h3 className="text-base">Button</h3>
        <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
          <Select value={state.ctaType} onValueChange={(v) => patch({ ctaType: v as ComposeState['ctaType'] })}>
            <SelectTrigger aria-label="Button type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">No button</SelectItem>
              {CTA_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CTA_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.ctaType !== 'NONE' && state.ctaType !== 'CALL' && (
            <Input
              type="url"
              aria-label="Button link"
              value={state.ctaUrl}
              onChange={(e) => patch({ ctaUrl: e.target.value })}
              placeholder="https://… (leave empty to use each client's default link or website)"
            />
          )}
          {state.ctaType === 'CALL' && (
            <p className="self-center text-sm text-orbit-muted">Calls the phone number on each Business Profile.</p>
          )}
        </div>
      </section>

      <ImageSection state={state} patch={patch} clientId={clientId} />
    </div>
  );
}

function ImageSection({ state, patch, clientId }: { state: ComposeState; patch: (p: Partial<ComposeState>) => void; clientId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadImage(file);
      patch({ upload: uploaded, imageChoice: 'upload' });
      toast.success('Image uploaded', { description: `${uploaded.width}×${uploaded.height}, ${(uploaded.bytes / 1024).toFixed(0)} KB` });
    } catch (err) {
      toast.error('Upload failed', { description: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="grid gap-3">
      <h3 className="text-base">Image</h3>
      <Segmented<ImageChoice>
        ariaLabel="Image"
        value={state.imageChoice}
        onChange={(v) => patch({ imageChoice: v })}
        options={[
          { value: 'auto', label: 'Auto', icon: Sparkles },
          { value: 'upload', label: 'Upload', icon: ImageIcon },
          ...(clientId ? [{ value: 'library' as const, label: 'From library', icon: Images }] : []),
          { value: 'none', label: 'No image', icon: ImageOff },
        ]}
      />
      {!clientId && state.selected.length > 0 && (
        <p className="text-xs text-orbit-muted">Picking a specific library image is available when all selected locations belong to one client.</p>
      )}
      {state.imageChoice === 'library' && clientId && (
        <LibraryPicker clientId={clientId} selectedId={state.libraryImage?.id ?? null} onPick={(img) => patch({ libraryImage: img })} />
      )}
      {state.imageChoice === 'auto' && (
        <p className="text-sm text-orbit-muted">
          Each post gets the next unused image from its client's library when it publishes. If the
          library is empty, a branded graphic is generated instead.
        </p>
      )}
      {state.imageChoice === 'upload' && (
        <div>
          {state.upload ? (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-orbit-line bg-white/70 p-3">
              <img src={state.upload.url} alt="Uploaded" className="h-24 w-32 rounded-xl object-cover" />
              <div className="text-sm">
                <p className="font-semibold text-orbit-heading">Image ready</p>
                <p className="text-orbit-muted">
                  {state.upload.width}×{state.upload.height} · {(state.upload.bytes / 1024).toFixed(0)} KB · used for every selected location
                </p>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => patch({ upload: null })}>
                <Trash2 /> Remove
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleFile(e.dataTransfer.files[0]);
              }}
              disabled={uploading}
              className={cn(
                'flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-orbit-primary/30 bg-white/60 px-6 py-10 text-center transition hover:border-orbit-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60',
                dragOver && 'border-orbit-primary bg-orbit-primary/5',
              )}
            >
              {uploading ? <Loader2 className="h-7 w-7 animate-spin text-orbit-primary" /> : <Upload className="h-7 w-7 text-orbit-primary" />}
              <span className="font-semibold text-orbit-heading">{uploading ? 'Processing image…' : 'Drop an image or click to upload'}</span>
              <span className="text-xs text-orbit-muted">JPG, PNG, WEBP or HEIC up to 15 MB, at least 400×300px</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </section>
  );
}
