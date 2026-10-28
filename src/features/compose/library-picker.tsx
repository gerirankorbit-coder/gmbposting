import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { LibraryImageDTO } from '../../../shared/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientLibrary } from '@/features/library/use-library';

export function LibraryPicker({ clientId, selectedId, onPick }: { clientId: string; selectedId: string | null; onPick: (img: LibraryImageDTO) => void }) {
  const { data, isLoading } = useClientLibrary(clientId);
  const images = (data?.images ?? []).filter((i) => i.is_active).sort((a, b) => a.used_count - b.used_count);
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
        ))}
      </div>
    );
  }
  if (!images.length) {
    return (
      <p className="rounded-2xl border border-dashed border-orbit-line p-5 text-center text-sm text-orbit-muted">
        This client's library is empty.{' '}
        <Link to={`/library/${clientId}`} className="font-semibold text-orbit-primary hover:underline">
          Upload images
        </Link>
      </p>
    );
  }
  return (
    <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4" aria-label="Library images">
      {images.map((img) => {
        const on = img.id === selectedId;
        return (
          <li key={img.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onPick(img)}
              className={cn(
                'relative block w-full overflow-hidden rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60',
                on ? 'border-orbit-primary' : 'border-transparent hover:border-orbit-primary/40',
              )}
            >
              <img src={img.public_url} alt={img.original_filename ?? ''} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <span className="absolute left-1.5 top-1.5">
                {img.used_count === 0 ? <Badge variant="emerald">Unused</Badge> : <Badge variant="slate">×{img.used_count}</Badge>}
              </span>
              {on && (
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-orbit-gradient text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
