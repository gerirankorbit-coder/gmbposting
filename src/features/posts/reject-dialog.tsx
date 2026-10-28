import { useEffect, useState } from 'react';
import { Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRejectPosts } from './use-post-actions';

export function RejectDialog({ ids, open, onOpenChange, onDone }: { ids: string[]; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const [note, setNote] = useState('');
  const reject = useRejectPosts();
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send back {ids.length === 1 ? 'this post' : `${ids.length} posts`}</DialogTitle>
          <DialogDescription>The posts return to drafts with your note so the writer can fix and resubmit them.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="reject-note">Note for the writer</Label>
          <Textarea id="reject-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Mention the new opening hours and remove the price." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!note.trim() || reject.isPending}
            onClick={() =>
              reject.mutate(
                { ids, note: note.trim() },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    onDone?.();
                  },
                },
              )
            }
          >
            {reject.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
