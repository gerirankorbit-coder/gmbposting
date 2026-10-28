import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { BRANDED_TEMPLATES, type BrandedTemplate, type PostListItemDTO } from '../../../shared/types';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUTO = 'auto';
const NAMES: Record<BrandedTemplate, string> = { gradient: 'Bold gradient', split: 'Logo split', minimal: 'Minimal card', badge: 'Badge' };

export function BrandedDialog({ post, open, onOpenChange }: { post: PostListItemDTO | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [template, setTemplate] = useState<string>(AUTO);
  const [current, setCurrent] = useState<PostListItemDTO | null>(post);
  useEffect(() => {
    if (open) {
      setTemplate(AUTO);
      setCurrent(post);
    }
  }, [open, post]);
  const generate = useMutation({
    mutationFn: () => api.post<PostListItemDTO>(`/posts/${post!.id}/branded`, template === AUTO ? {} : { template }),
    onSuccess: (p) => {
      setCurrent(p);
      qc.setQueryData(qk.post(p.id), p);
      void qc.invalidateQueries({ queryKey: qk.postsAll });
      toast.success('Branded graphic generated');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  if (!post) return null;
  const showing = current?.image_source === 'branded' ? current.media_url : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Branded graphic</DialogTitle>
          <DialogDescription>Generate a graphic in {post.location?.client?.name ?? 'the client'}'s brand colours for this post. It replaces the post's current image.</DialogDescription>
        </DialogHeader>
        {showing ? (
          <img src={showing} alt="Branded graphic" className="aspect-[4/3] w-full rounded-2xl border border-orbit-line object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-orbit-gradient-soft text-sm text-orbit-muted">
            {generate.isPending ? <Loader2 className="h-6 w-6 animate-spin text-orbit-primary" /> : 'No branded graphic yet'}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="branded-template">Template</Label>
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger id="branded-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Automatic rotation</SelectItem>
              {BRANDED_TEMPLATES.map((t) => (
                <SelectItem key={t} value={t}>
                  {NAMES[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {showing ? 'Regenerate' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
