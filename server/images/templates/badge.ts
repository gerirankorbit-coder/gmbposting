import { h, headlineSize, img, type SatoriNode, type TemplateInput, HEIGHT, WIDTH } from './h.js';

/** Template 4: badge/ribbon style, intended for offers and events. */
export function badgeTemplate(t: TemplateInput): SatoriNode {
  const label = t.topicLabel ?? 'New';
  const [a, b] = t.variant % 2 === 0 ? [t.primary, t.secondary] : [t.secondary, t.primary];
  return h(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      position: 'relative',
      background: '#ffffff',
      fontFamily: 'Plus Jakarta Sans',
      overflow: 'hidden',
    },
    h('div', { position: 'absolute', width: 1500, height: 520, top: 520, left: -150, backgroundImage: `linear-gradient(90deg, ${a} 0%, ${b} 100%)`, transform: 'rotate(-6deg)' }),
    h(
      'div',
      {
        position: 'absolute',
        top: 60,
        right: 70,
        width: 250,
        height: 250,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `linear-gradient(135deg, ${b} 0%, ${a} 100%)`,
        border: '10px solid #ffffff',
        boxShadow: '0 20px 50px rgba(20,10,60,0.25)',
        transform: 'rotate(12deg)',
        color: t.text,
        fontSize: label.length > 6 ? 40 : 52,
        fontWeight: 800,
        letterSpacing: 2,
        textTransform: 'uppercase',
      },
      label,
    ),
    h(
      'div',
      { display: 'flex', flexDirection: 'column', padding: '90px 0 0 90px', width: 820, boxSizing: 'border-box' },
      h('div', { display: 'flex', fontSize: 28, fontWeight: 700, color: a, letterSpacing: 3, textTransform: 'uppercase' }, t.businessName),
      h('div', { display: 'flex', fontSize: headlineSize(t.headline, 82), fontWeight: 800, lineHeight: 1.06, letterSpacing: -2, color: '#0B0B14', marginTop: 24 }, t.headline),
    ),
    h(
      'div',
      { position: 'absolute', left: 90, bottom: 80, display: 'flex', alignItems: 'center', gap: 24, color: t.text },
      t.logo ? img(t.logo, { borderRadius: 22, background: '#ffffff', padding: 8, objectFit: 'contain' }, 100, 100) : null,
      h(
        'div',
        { display: 'flex', flexDirection: 'column' },
        h('div', { display: 'flex', fontSize: 34, fontWeight: 800 }, t.city ?? t.businessName),
        t.tagline ? h('div', { display: 'flex', fontSize: 24, opacity: 0.9 }, t.tagline) : null,
      ),
    ),
  );
}
