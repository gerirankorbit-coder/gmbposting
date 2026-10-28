import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { allTimeZones } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function TimezoneSelect({
  value,
  onChange,
  id,
  className,
}: {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const zones = useMemo(allTimeZones, []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-10 w-full justify-between rounded-xl font-medium', className)}
        >
          <span className="truncate">{value || 'Select time zone'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0">
        <Command>
          <CommandInput placeholder="Search time zones…" />
          <CommandList>
            <CommandEmpty>No time zone found.</CommandEmpty>
            {zones.map((tz) => (
              <CommandItem
                key={tz}
                value={tz}
                onSelect={() => {
                  onChange(tz);
                  setOpen(false);
                }}
              >
                <Check className={cn(tz === value ? 'opacity-100' : 'opacity-0', 'text-orbit-primary')} />
                {tz.replace(/_/g, ' ')}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
