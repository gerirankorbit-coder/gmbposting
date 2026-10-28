import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useLocationOptions } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Searchable single-location picker. `value === ''` means "all locations". */
export function LocationCombobox({
  value,
  onChange,
  allLabel = 'All locations',
  className,
  ids,
}: {
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  className?: string;
  /** Restrict choices to these location ids. */
  ids?: string[];
}) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useLocationOptions();
  const options = useMemo(() => (ids ? data.filter((l) => ids.includes(l.id)) : data), [data, ids]);
  const current = options.find((l) => l.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className={cn('h-10 w-full justify-between rounded-xl font-medium', className)}>
          <span className="truncate">{current ? current.title : allLabel}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Search locations…" />
          <CommandList>
            <CommandEmpty>No location found.</CommandEmpty>
            {allLabel && (
              <CommandItem value="__all__" onSelect={() => { onChange(''); setOpen(false); }}>
                <Check className={cn('text-orbit-primary', value ? 'opacity-0' : 'opacity-100')} />
                {allLabel}
              </CommandItem>
            )}
            {options.map((l) => (
              <CommandItem key={l.id} value={`${l.title} ${l.city ?? ''} ${l.id}`} onSelect={() => { onChange(l.id); setOpen(false); }}>
                <Check className={cn('text-orbit-primary', value === l.id ? 'opacity-100' : 'opacity-0')} />
                <span className="wrap-anywhere">{l.title}</span>
                {l.city && <span className="ml-auto wrap-anywhere text-xs text-orbit-muted">{l.city}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
