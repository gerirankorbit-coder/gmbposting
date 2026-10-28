import { useEffect, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { zonedWallToUtc } from '../../../shared/schedule';
import type { PostListItemDTO } from '../../../shared/types';
import { browserTimeZone, formatInZone, formatLocal } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReschedulePost } from './use-post-actions';

export function RescheduleDialog({ post, open, onOpenChange }: { post: PostListItemDTO | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const tz = post?.location?.timezone ?? browserTimeZone();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const reschedule = useReschedulePost();
  useEffect(() => {
    if (!open || !post) return;
    const base = post.scheduled_at && new Date(post.scheduled_at) > new Date() ? post.scheduled_at : new Date(Date.now() + 3600_000).toISOString();
    setDate(formatInZone(base, tz, 'yyyy-MM-dd'));
    setTime(formatInZone(base, tz, 'HH:mm'));
  }, [open, post, tz]);
  if (!post) return null;
  const iso = date && time ? zonedWallToUtc(date, time, tz) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule post</DialogTitle>
          <DialogDescription>
            {post.location?.title} · time zone {tz}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rs-date">Date</Label>
            <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rs-time">Time</Label>
            <Input id="rs-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        {iso && tz !== browserTimeZone() && <p className="text-xs text-orbit-muted">Your local time: {formatLocal(iso)}</p>}
        {iso && new Date(iso) < new Date() && <p className="text-xs font-medium text-amber-700">This time is in the past, so the post publishes on the next run.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!iso || reschedule.isPending} onClick={() => iso && reschedule.mutate({ id: post.id, scheduled_at: iso }, { onSuccess: () => onOpenChange(false) })}>
            {reschedule.isPending ? <Loader2 className="animate-spin" /> : <CalendarClock />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
