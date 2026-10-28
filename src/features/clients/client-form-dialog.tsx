import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { clientInputSchema } from '../../../shared/schemas';
import type { ClientDTO } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCreateClient, useUpdateClient } from './use-client-actions';

export const CLIENT_COLOR_PRESETS = ['#8B2CF5', '#D946EF', '#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#6366F1', '#14B8A6', '#EC4899'];

const formSchema = clientInputSchema.pick({
  name: true,
  color: true,
  is_active: true,
  brand_voice: true,
  default_cta_url: true,
  notes: true,
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function ClientFormDialog({
  client,
  open,
  onOpenChange,
}: {
  client: ClientDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateClient();
  const update = useUpdateClient();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', color: CLIENT_COLOR_PRESETS[0], is_active: true, brand_voice: '', default_cta_url: '', notes: '' },
  });
  const { register, handleSubmit, reset, setValue, watch, formState } = form;

  useEffect(() => {
    if (!open) return;
    reset({
      name: client?.name ?? '',
      color: client?.color ?? CLIENT_COLOR_PRESETS[0],
      is_active: client?.is_active ?? true,
      brand_voice: client?.brand_voice ?? '',
      default_cta_url: client?.default_cta_url ?? '',
      notes: client?.notes ?? '',
    });
  }, [client, open, reset]);

  const busy = create.isPending || update.isPending;
  const onSubmit = handleSubmit((values) => {
    const done = { onSuccess: () => onOpenChange(false) };
    if (client) update.mutate({ id: client.id, patch: values }, done);
    else create.mutate(values, done);
  });
  const color = watch('color') ?? CLIENT_COLOR_PRESETS[0]!;
  const errors = formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit client' : 'New client'}</DialogTitle>
          <DialogDescription>
            Brand voice and the default link are used when writing posts and filling in CTA buttons.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="client-name">Name</Label>
            <Input id="client-name" aria-invalid={!!errors.name} {...register('name')} />
            {errors.name && <p className="text-xs text-rose-600">{errors.name.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-color">Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {CLIENT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use color ${c}`}
                  onClick={() => setValue('color', c, { shouldDirty: true })}
                  className={cn(
                    'h-8 w-8 rounded-full ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary',
                    color.toLowerCase() === c.toLowerCase() && 'ring-2 ring-orbit-heading',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <Input id="client-color" type="color" className="h-8 w-12 cursor-pointer p-0.5" {...register('color')} />
            </div>
            {errors.color && <p className="text-xs text-rose-600">{errors.color.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-voice">Brand voice</Label>
            <Textarea
              id="client-voice"
              rows={4}
              placeholder="Tone, words to use or avoid, key services… e.g. Friendly and expert. Mention eco-friendly materials. Avoid the word 'cheap'."
              {...register('brand_voice')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-cta">Default CTA URL</Label>
            <Input id="client-cta" type="url" placeholder="https://example.com/contact" aria-invalid={!!errors.default_cta_url} {...register('default_cta_url')} />
            {errors.default_cta_url && <p className="text-xs text-rose-600">{errors.default_cta_url.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-notes">Internal notes</Label>
            <Textarea id="client-notes" rows={2} {...register('notes')} />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-orbit-line bg-white/70 px-4 py-3">
            <div>
              <Label htmlFor="client-active">Active client</Label>
              <p className="text-xs text-orbit-muted">Inactive clients are hidden from the library and dashboard by default.</p>
            </div>
            <Switch
              id="client-active"
              checked={watch('is_active') ?? true}
              onCheckedChange={(v) => setValue('is_active', v, { shouldDirty: true })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {client ? 'Save changes' : 'Create client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
