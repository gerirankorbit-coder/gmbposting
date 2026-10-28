import { AlertTriangle } from 'lucide-react';
import { daysSince, formatLocal } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const STALE_DAYS = 7;

export function LastPostCell({ iso }: { iso: string | null }) {
  const days = daysSince(iso);
  const stale = days === null || days >= STALE_DAYS;
  return (
    <div className="flex flex-col items-start gap-1">
      {iso ? (
        <Tooltip>
          <TooltipTrigger className="text-sm text-orbit-body underline decoration-dotted underline-offset-4">
            {days === 0 ? 'Today' : `${days}d ago`}
          </TooltipTrigger>
          <TooltipContent>{formatLocal(iso)}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-sm text-orbit-muted">Never</span>
      )}
      {stale && (
        <Badge variant="amber" className="whitespace-nowrap">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Needs a post
        </Badge>
      )}
    </div>
  );
}

