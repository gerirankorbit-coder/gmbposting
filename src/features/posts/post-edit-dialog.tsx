import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageIcon, ImageOff, Loader2, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { contentWarnings } from '../../../shared/content';
import type { PostUpdate } from '../../../shared/schemas';
import { zonedWallToUtc } from '../../../shared/schedule';
import { CTA_TYPES, type CtaType, type LocationDTO, type PostListItemDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { formatInZone } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { IMAGE_ACCEPT, uploadImage } from '@/lib/upload';
import { CharCounter } from '@/components/app/char-counter';
import { CTA_BUTTON_LABEL } from '@/components/app/post-preview';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdatePost } from './use-post-actions';

type ImageMode = 'keep' | 'upload' | 'auto' | 'none';

export function PostEditDialog({ post, open, onOpenChange }: { post: PostListItemDTO | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdatePost();
  const fileRef = useRef<HTMLInputElement>(null);
  const tz = post?.location?.timezone ?? 'UTC';
  const { data: location } = useQuery({
    queryKey: qk.location(post?.location_id ?? ''),
    queryFn: () => api.get<LocationDTO>(`/locations/${post!.location_id}`),
    enabled: open && !!post,
  });

  const [summary, setSummary] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [ctaType, setCtaType] = useState<CtaType | 'NONE'>('NONE');
  const [ctaUrl, setCtaUrl] = useState('');
  const [imageMode, setImageMode] = useState<ImageMode>('keep');
  const [upload, setUpload] = useState<{ url: string; path: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [start, setStart] = useState({ date: '', time: '' });
  const [end, setEnd] = useState({ date: '', time: '' });
  const [coupon, setCoupon] = useState('');
  const [redeem, setRedeem] = useState('');
  const [terms, setTerms] = useState('');

  useEffect(() => {
    if (!open || !post) return;
    setSummary(post.summary);
    setConnectionId(post.connection_id ?? '');
    setCtaType(post.cta_type ?? 'NONE');
    setCtaUrl(post.cta_url ?? '');
    setImageMode(post.media_url ? 'keep' : post.image_source === 'none' ? 'none' : 'auto');
    setUpload(null);
    setEventTitle(post.event_title ?? '');
    setStart({ date: post.event_start ? formatInZone(post.event_start, tz, 'yyyy-MM-dd') : '', time: post.event_start ? formatInZone(post.event_start, tz, 'HH:mm') : '09:00' });
    setEnd({ date: post.event_end ? formatInZone(post.event_end, tz, 'yyyy-MM-dd') : '', time: post.event_end ? formatInZone(post.event_end, tz, 'HH:mm') : '18:00' });
    setCoupon(post.offer_coupon_code ?? '');
    setRedeem(post.offer_redeem_url ?? '');
    setTerms(post.offer_terms ?? '');
  }, [open, post, tz]);

  if (!post) return null;
  const eventLike = post.topic_type !== 'STANDARD';
  const warnings = contentWarnings(summary);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadImage(file);
      setUpload({ url: up.url, path: up.path });
      setImageMode('upload');
    } catch (err) {
      toast.error('Upload failed', { description: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const patch: PostUpdate = {
      summary,
      cta_type: ctaType === 'NONE' ? null : ctaType,
      cta_url: ctaType === 'NONE' || ctaType === 'CALL' ? null : ctaUrl.trim(),
    };
    if (connectionId && connectionId !== post.connection_id) patch.connection_id = connectionId;
    if (imageMode === 'upload' && upload) Object.assign(patch, { image_source: 'upload', media_url: upload.url, media_path: upload.path });
    if (imageMode === 'auto' || imageMode === 'none') patch.image_source = imageMode;
    if (eventLike) {
      if (!start.date || !end.date) {
        toast.error('Add start and end dates.');
        return;
      }
      Object.assign(patch, {
        event_title: eventTitle.trim(),
        event_start: zonedWallToUtc(start.date, start.time || '00:00', tz),
        event_end: zonedWallToUtc(end.date, end.time || '23:59', tz),
      });
    }
    if (post.topic_type === 'OFFER') {
      Object.assign(patch, { offer_coupon_code: coupon.trim() || null, offer_redeem_url: redeem.trim(), offer_terms: terms.trim() || null });
    }
    update.mutate({ id: post.id, patch }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>{post.location?.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          {eventLike && (
            <div className="grid gap-3 rounded-2xl border border-orbit-line bg-white/60 p-4">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-event-title">Title</Label>
                <Input id="edit-event-title" maxLength={58} value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7rem] gap-2">
                  <Input type="date" aria-label="Start date" value={start.date} onChange={(e) => setStart({ ...start, date: e.target.value })} />
                  <Input type="time" aria-label="Start time" value={start.time} onChange={(e) => setStart({ ...start, time: e.target.value })} />
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7rem] gap-2">
                  <Input type="date" aria-label="End date" value={end.date} onChange={(e) => setEnd({ ...end, date: e.target.value })} />
                  <Input type="time" aria-label="End time" value={end.time} onChange={(e) => setEnd({ ...end, time: e.target.value })} />
                </div>
              </div>
              {post.topic_type === 'OFFER' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input aria-label="Coupon code" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                  <Input aria-label="Redeem URL" type="url" placeholder="Redeem online URL" value={redeem} onChange={(e) => setRedeem(e.target.value)} />
                  <Textarea aria-label="Terms" className="sm:col-span-2" rows={2} placeholder="Terms and conditions" value={terms} onChange={(e) => setTerms(e.target.value)} />
                </div>
              )}
            </div>
          )}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-summary">Post text</Label>
              <CharCounter length={summary.length} />
            </div>
            <Textarea id="edit-summary" rows={9} value={summary} onChange={(e) => setSummary(e.target.value)} />
            {warnings.map((w) => (
              <p key={w} className="text-xs font-medium text-amber-700">{w}</p>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            <Select value={ctaType} onValueChange={(v) => setCtaType(v as CtaType | 'NONE')}>
              <SelectTrigger aria-label="Button">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No button</SelectItem>
                {CTA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CTA_BUTTON_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ctaType !== 'NONE' && ctaType !== 'CALL' && (
              <Input type="url" aria-label="Button link" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://… (empty = client default or website)" />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-conn">Publish with</Label>
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger id="edit-conn">
                <SelectValue placeholder={post.connection_email ?? 'Choose Gmail'} />
              </SelectTrigger>
              <SelectContent>
                {(location?.access ?? []).map((a) => (
                  <SelectItem key={a.connection_id} value={a.connection_id} disabled={a.status !== 'active'}>
                    {a.email}
                    {a.status !== 'active' ? ' (reconnect)' : ''}
                  </SelectItem>
                ))}
                {!location && post.connection_id && <SelectItem value={post.connection_id}>{post.connection_email ?? 'Current Gmail'}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Image</Label>
            <Segmented<ImageMode>
              ariaLabel="Image"
              size="sm"
              value={imageMode}
              onChange={(v) => (v === 'upload' && !upload ? fileRef.current?.click() : setImageMode(v))}
              options={[
                ...(post.media_url ? [{ value: 'keep' as const, label: 'Keep current', icon: ImageIcon }] : []),
                { value: 'upload', label: upload ? 'New upload' : 'Upload new', icon: Upload },
                { value: 'auto', label: 'Auto', icon: Sparkles },
                { value: 'none', label: 'No image', icon: ImageOff },
              ]}
            />
            {uploading && (
              <p className="flex items-center gap-2 text-xs text-orbit-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing image…
              </p>
            )}
            {(imageMode === 'keep' ? post.media_url : imageMode === 'upload' ? upload?.url : null) && (
              <img src={(imageMode === 'keep' ? post.media_url : upload?.url) ?? ''} alt="" className="h-28 w-40 rounded-xl object-cover" />
            )}
            <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending || uploading || summary.length > 1500}>
            {update.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
