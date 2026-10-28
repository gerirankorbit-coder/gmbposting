import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ImportRowDTO } from '../../../shared/types';
import { CharCounter } from '@/components/app/char-counter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateImportRow } from './use-imports';

export function RowEditDialog({ importId, row, open, onOpenChange }: { importId: string; row: ImportRowDTO | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateImportRow(importId);
  const [content, setContent] = useState('');
  const [gmail, setGmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [image, setImage] = useState('');
  useEffect(() => {
    if (!open || !row) return;
    setContent(row.raw.post_content ?? '');
    setGmail(row.raw.gmail ?? '');
    setDate(row.raw.schedule_date ?? '');
    setTime(row.raw.schedule_time ?? '');
    setImage(row.raw.image ?? '');
  }, [open, row]);
  if (!row) return null;
  const save = () =>
    update.mutate(
      { rowId: row.id, patch: { post_content: content, gmail, schedule_date: date, schedule_time: time, image } },
      { onSuccess: () => onOpenChange(false) },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit row {row.row_number}</DialogTitle>
          <DialogDescription>{row.resolved?.location_title ?? row.raw.business_name ?? 'Unmatched business'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="row-content">Post content</Label>
              <CharCounter length={content.length} />
            </div>
            <Textarea id="row-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="row-gmail">Gmail</Label>
            <Input id="row-gmail" type="email" value={gmail} onChange={(e) => setGmail(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="row-date">Schedule date</Label>
              <Input id="row-date" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="row-time">Time (location time zone)</Label>
              <Input id="row-time" type="time" value={/^\d{2}:\d{2}$/.test(time) ? time : ''} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="row-image">Image URL or filename</Label>
            <Input id="row-image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="Empty = Auto (library, then branded graphic)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending && <Loader2 className="animate-spin" />} Save & re-check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
