import { browserTimeZone, formatInZone, formatLocal } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Shows a time in the location's zone, with the viewer's local time in a tooltip. */
export function ZonedTime({ iso, timeZone, className }: { iso: string | null; timeZone: string; className?: string }) {
  if (!iso) return <span className={className}>—</span>;
  const sameZone = timeZone === browserTimeZone();
  return (
    <Tooltip>
      <TooltipTrigger className={className ?? 'text-left text-sm underline decoration-dotted underline-offset-4'}>
        {formatInZone(iso, timeZone)}
      </TooltipTrigger>
      <TooltipContent>
        {sameZone ? `${timeZone} (your time zone)` : `${timeZone} · Your time: ${formatLocal(iso)}`}
      </TooltipContent>
    </Tooltip>
  );
}
