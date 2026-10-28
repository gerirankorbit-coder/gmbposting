import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BRANDED_TEMPLATES, type BrandedTemplate, type ClientDTO } from '../../../shared/types';
import { errorMessage } from '@/lib/api';
import { uploadIncoming } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientAvatar } from './library-page';
import { TemplatePreview } from './template-preview';
import { useLogo, useSaveBrandKit } from './use-library';

const TEMPLATE_INFO: Record<BrandedTemplate, { name: string; hint: string }> = {
  gradient: { name: 'Bold gradient', hint: 'Big headline on brand gradient' },
  split: { name: 'Logo split', hint: 'Large logo panel + headline' },
  minimal: { name: 'Minimal card', hint: 'White card, accent bar' },
  badge: { name: 'Badge', hint: 'Ribbon badge for offers & events' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function ColorField({ id, label, value, placeholder, swatch, onChange }: { id: string; label: string; value: string; placeholder: string; swatch: string; onChange: (v: string) => void }) {
  const valid = !value || HEX.test(value);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          aria-label={`${label} picker`}
          className="h-10 w-12 shrink-0 cursor-pointer p-1"
          value={HEX.test(value) ? value : swatch}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <Input id={id} value={value} placeholder={`Auto (${placeholder})`} aria-invalid={!valid} onChange={(e) => onChange(e.target.value.trim())} />
        {value && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Reset ${label}`} onClick={() => onChange('')}>
            <RotateCcw />
          </Button>
        )}
      </div>
      {!valid && <p className="text-xs text-rose-600">Use a hex colour like #8B2CF5.</p>}
    </div>
  );
}

export function BrandKitEditor({ client, canEdit }: { client: ClientDTO; canEdit: boolean }) {
  const save = useSaveBrandKit(client.id);
  const logo = useLogo(client.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [text, setText] = useState('');
  const [tagline, setTagline] = useState('');
  const [templates, setTemplates] = useState<BrandedTemplate[]>([]);

  useEffect(() => {
    setPrimary(client.brand_primary ?? '');
    setSecondary(client.brand_secondary ?? '');
    setText(client.brand_text_color ?? '');
    setTagline(client.tagline ?? '');
    setTemplates(client.preferred_templates ?? []);
  }, [client]);

  const valid = [primary, secondary, text].every((v) => !v || HEX.test(v));
  const overrides = {
    brand_primary: HEX.test(primary) ? primary : null,
    brand_secondary: HEX.test(secondary) ? secondary : null,
    brand_text_color: HEX.test(text) ? text : null,
    tagline: tagline.trim() || null,
  };
  const dirty =
    (client.brand_primary ?? '') !== primary ||
    (client.brand_secondary ?? '') !== secondary ||
    (client.brand_text_color ?? '') !== text ||
    (client.tagline ?? '') !== tagline ||
    [...(client.preferred_templates ?? [])].sort().join() !== [...templates].sort().join();

  const toggleTemplate = (t: BrandedTemplate) =>
    setTemplates((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const onLogo = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      logo.upload.mutate(await uploadIncoming(file));
    } catch (err) {
      toast.error('Logo upload failed', { description: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="grid content-start gap-5">
        <div className="grid gap-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <ClientAvatar client={client} size={72} />
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || logo.upload.isPending}>
                  {uploading || logo.upload.isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                  {client.logo_url ? 'Replace' : 'Upload logo'}
                </Button>
                {client.logo_url && (
                  <Button variant="ghost" size="sm" onClick={() => logo.remove.mutate()} disabled={logo.remove.isPending}>
                    <Trash2 /> Remove
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-orbit-muted">PNG with a transparent background works best.</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" tabIndex={-1} onChange={(e) => { void onLogo(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <ColorField id="brand-primary" label="Primary colour" value={primary} placeholder={client.color.toUpperCase()} swatch={client.color} onChange={setPrimary} />
        <ColorField id="brand-secondary" label="Secondary colour" value={secondary} placeholder="derived from primary" swatch={HEX.test(primary) ? primary : client.color} onChange={setSecondary} />
        <ColorField id="brand-text" label="Text colour on brand colour" value={text} placeholder="white or dark, by contrast" swatch="#FFFFFF" onChange={setText} />
        <div className="grid gap-1.5">
          <Label htmlFor="brand-tagline">Tagline</Label>
          <Input id="brand-tagline" maxLength={80} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Packaging that ships smiles" />
        </div>
        {canEdit && (
          <Button
            className="justify-self-start"
            disabled={!dirty || !valid || save.isPending}
            onClick={() =>
              save.mutate({
                brand_primary: overrides.brand_primary,
                brand_secondary: overrides.brand_secondary,
                brand_text_color: overrides.brand_text_color,
                tagline: overrides.tagline,
                preferred_templates: templates,
              })
            }
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save brand kit
          </Button>
        )}
      </div>

      <div>
        <div className="mb-3">
          <h3 className="text-base">Branded graphic templates</h3>
          <p className="text-sm text-orbit-muted">
            Used when the library is empty. Select the ones to rotate through (none selected = all). Previews update as you edit.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {BRANDED_TEMPLATES.map((t) => {
            const on = templates.includes(t);
            return (
              <li key={t}>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleTemplate(t)}
                  aria-pressed={on}
                  className={cn(
                    'group w-full rounded-3xl border bg-white/70 p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/60',
                    on ? 'border-orbit-primary ring-2 ring-orbit-primary/20' : 'border-orbit-line hover:border-orbit-primary/40',
                  )}
                >
                  <TemplatePreview clientId={client.id} template={t} topic={t === 'badge' ? 'OFFER' : 'STANDARD'} overrides={overrides} version={client.logo_url} />
                  <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-2.5">
                    <div>
                      <p className="text-sm font-bold text-orbit-heading">{TEMPLATE_INFO[t].name}</p>
                      <p className="text-xs text-orbit-muted">{TEMPLATE_INFO[t].hint}</p>
                    </div>
                    <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', on ? 'border-transparent bg-orbit-gradient text-white' : 'border-orbit-line text-transparent')}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
