import { useState } from 'react';
import { CalendarDays, ImageOff, MoreVertical, Sparkles, Tag } from 'lucide-react';
import type { CtaType, TopicType } from '../../../shared/types';
import { cn } from '@/lib/utils';

export const CTA_BUTTON_LABEL: Record<CtaType, string> = {
  BOOK: 'Book',
  ORDER: 'Order online',
  SHOP: 'Buy',
  LEARN_MORE: 'Learn more',
  SIGN_UP: 'Sign up',
  CALL: 'Call now',
};

export interface PostPreviewProps {
  businessName: string;
  topicType: TopicType;
  summary: string;
  imageUrl?: string | null;
  imageMode: 'image' | 'auto' | 'none';
  ctaType: CtaType | null;
  eventTitle?: string | null;
  eventRange?: string | null;
  couponCode?: string | null;
  whenLabel?: string;
  className?: string;
}

/** Approximation of how a post renders on a Google Business Profile. */
export function PostPreview(p: PostPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const long = p.summary.length > 280;
  return (
    <article className={cn('overflow-hidden rounded-3xl border border-orbit-line bg-white shadow-glass', p.className)} aria-label="Post preview">
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orbit-gradient text-sm font-bold text-white">
          {p.businessName[0]?.toUpperCase() ?? 'B'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="wrap-anywhere text-sm font-semibold text-[#202124]">{p.businessName || 'Business name'}</p>
          <p className="text-xs text-[#5f6368]">{p.whenLabel ?? 'Just now'}</p>
        </div>
        <MoreVertical className="h-4 w-4 text-[#5f6368]" aria-hidden />
      </header>
      {p.imageMode === 'image' && p.imageUrl ? (
        <img src={p.imageUrl} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : p.imageMode === 'auto' ? (
        <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 overflow-hidden bg-orbit-gradient text-center text-white">
          <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15" />
          <span aria-hidden className="absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-white/10" />
          <Sparkles className="h-7 w-7" aria-hidden />
          <p className="px-6 text-sm font-bold">Auto image</p>
          <p className="max-w-[80%] px-6 text-xs text-white/85">Next unused library photo, or a branded graphic, picked at publish time</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-y border-[#e8eaed] bg-[#f8f9fa] px-4 py-2 text-xs text-[#5f6368]">
          <ImageOff className="h-3.5 w-3.5" aria-hidden /> No image
        </div>
      )}
      <div className="space-y-2 px-4 py-3">
        {p.topicType !== 'STANDARD' && (
          <div>
            <p className="flex items-center gap-1.5 text-base font-semibold text-[#202124]">
              {p.topicType === 'OFFER' ? <Tag className="h-4 w-4 text-[#1a73e8]" aria-hidden /> : <CalendarDays className="h-4 w-4 text-[#1a73e8]" aria-hidden />}
              {p.eventTitle || (p.topicType === 'OFFER' ? 'Offer title' : 'Event title')}
            </p>
            {p.eventRange && <p className="text-xs text-[#5f6368]">{p.eventRange}</p>}
          </div>
        )}
        <p className={cn('whitespace-pre-line text-sm leading-relaxed text-[#3c4043]', !expanded && 'line-clamp-6')}>
          {p.summary || <span className="italic text-[#9aa0a6]">Your post text appears here.</span>}
        </p>
        {long && (
          <button type="button" className="text-xs font-semibold text-[#1a73e8] hover:underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : 'More'}
          </button>
        )}
        {p.topicType === 'OFFER' && p.couponCode && (
          <div className="rounded-xl border border-dashed border-[#1a73e8]/50 bg-[#e8f0fe] px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[#5f6368]">Show this code at the store</p>
            <p className="font-mono text-sm font-bold text-[#1a73e8]">{p.couponCode}</p>
          </div>
        )}
      </div>
      {p.ctaType && (
        <div className="px-4 pb-4">
          <span className="inline-flex rounded-full border border-[#dadce0] px-4 py-1.5 text-sm font-medium text-[#1a73e8]">
            {CTA_BUTTON_LABEL[p.ctaType]}
          </span>
        </div>
      )}
    </article>
  );
}
