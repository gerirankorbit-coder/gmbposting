import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileArchive, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ClientDTO, LibraryUploadResult } from '../../../shared/types';
import { pluralize } from '@/lib/format';
import { useLocationOptions } from '@/lib/queries';
import { qk } from '@/lib/query-keys';
import { IMAGE_ACCEPT } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { expandFiles, uploadToLibrary, type UploadProgress } from './library-upload';

const ALL_LOCATIONS = '__all__';

/** Drop zone that accepts images and ZIP files. Used inline and in the upload dialog. */
export function LibraryDropzone({ client, onDone, compact = false }: { client: ClientDTO; onDone?: (r: LibraryUploadResult) => void; compact?: boolean }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: locations = [] } = useLocationOptions();
  const clientLocations = locations.filter((l) => l.client?.id === client.id);
  const [locationId, setLocationId] = useState(ALL_LOCATIONS);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const handle = async (list: FileList | File[]) => {
    const raw = Array.from(list);
    if (!raw.length) return;
    const { files, skipped } = await expandFiles(raw).catch(() => ({ files: [] as File[], skipped: raw.map((f) => f.name) }));
    if (!files.length) {
      toast.error('No images found', { description: 'Use JPG, PNG, WEBP or HEIC files, or a ZIP of them.' });
      return;
    }
    setProgress({ total: files.length, uploaded: 0, processed: 0 });
    const result = await uploadToLibrary(client.id, files, locationId === ALL_LOCATIONS ? null : locationId, setProgress);
    setProgress(null);
    void qc.invalidateQueries({ queryKey: qk.libraryAll });
    void qc.invalidateQueries({ queryKey: qk.notificationsAll });
    const parts = [`${pluralize(result.added, 'image')} added`];
    if (result.duplicates) parts.push(`${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped`);
    if (skipped.length) parts.push(`${skipped.length} non-image file${skipped.length === 1 ? '' : 's'} ignored`);
    if (result.errors.length) toast.warning(parts.join(' · '), { description: result.errors.slice(0, 4).join('\n'), duration: 10_000 });
    else toast.success(parts.join(' · '));
    onDone?.(result);
  };

  const busy = !!progress;
  const pct = progress ? Math.round(((progress.uploaded + progress.processed) / Math.max(1, progress.total * 2)) * 100) : 0;

  return (
    <div className="grid gap-3">
      {clientLocations.length > 1 && (
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="upload-location">Use these images for</Label>
          <Select value={locationId} onValueChange={setLocationId} disabled={busy}>
            <SelectTrigger id="upload-location">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LOCATIONS}>All of {client.name}'s locations</SelectItem>
              {clientLocations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  Only {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-orbit-primary/30 bg-white/60 px-6 text-center transition hover:border-orbit-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60 disabled:cursor-wait',
          compact ? 'py-6' : 'py-10',
          drag && 'border-orbit-primary bg-orbit-primary/5',
        )}
      >
        {busy ? <Loader2 className="h-7 w-7 animate-spin text-orbit-primary" /> : <Upload className="h-7 w-7 text-orbit-primary" />}
        <span className="font-semibold text-orbit-heading">
          {busy ? `Uploading ${progress!.uploaded}/${progress!.total}, processed ${progress!.processed}/${progress!.total}…` : 'Drop images or a ZIP, or click to choose'}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-orbit-muted">
          <FileArchive className="h-3.5 w-3.5" aria-hidden /> JPG, PNG, WEBP, HEIC up to 15 MB each · ZIP archives are unpacked in your browser
        </span>
        {busy && (
          <span className="mt-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-orbit-primary/10" aria-hidden>
            <span className="block h-full rounded-full bg-orbit-gradient transition-all" style={{ width: `${pct}%` }} />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={`${IMAGE_ACCEPT},.zip,application/zip`}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) void handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function UploadDialog({ client, open, onOpenChange }: { client: ClientDTO | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open) setDone(false);
  }, [open]);
  if (!client) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload images for {client.name}</DialogTitle>
          <DialogDescription>Each auto-image post uses the next unused image. Duplicates are skipped automatically.</DialogDescription>
        </DialogHeader>
        <LibraryDropzone client={client} onDone={() => setDone(true)} />
        <DialogFooter>
          <Button variant={done ? 'default' : 'outline'} onClick={() => onOpenChange(false)}>
            {done ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
