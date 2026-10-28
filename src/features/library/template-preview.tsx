import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { BrandedTemplate, TopicType } from '../../../shared/types';
import { api } from '@/lib/api';
import { useDebounce } from '@/lib/use-debounce';
import { Skeleton } from '@/components/ui/skeleton';

export interface PreviewOverrides {
  brand_primary: string | null;
  brand_secondary: string | null;
  brand_text_color: string | null;
  tagline: string | null;
}

/** Renders a branded template on the server with unsaved brand-kit overrides. */
export function TemplatePreview({
  clientId,
  template,
  overrides,
  topic = 'STANDARD',
  version,
}: {
  clientId: string;
  template: BrandedTemplate;
  overrides: PreviewOverrides;
  topic?: TopicType;
  /** Bump to force a refresh (e.g. after a logo change). */
  version?: string | null;
}) {
  const debounced = useDebounce(JSON.stringify(overrides), 600);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setFailed(false);
    api
      .postForBlob(`/library/${clientId}/preview`, { template, topic, overrides: JSON.parse(debounced) as PreviewOverrides }, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clientId, template, topic, debounced, version]);

  if (failed) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-2xl bg-orbit-primary/5 text-xs text-orbit-muted">
        <ImageOff className="h-5 w-5" aria-hidden /> Preview unavailable
      </div>
    );
  }
  if (!url) return <Skeleton className="aspect-[4/3] w-full rounded-2xl" />;
  return <img src={url} alt={`${template} template preview`} className="aspect-[4/3] w-full rounded-2xl border border-orbit-line object-cover" />;
}
