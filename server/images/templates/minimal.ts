import { h, headlineSize, img, type SatoriNode, type TemplateInput, HEIGHT, WIDTH } from './h.js';

/** Template 3: minimal white card with a brand-colour accent bar. */
export function minimalTemplate(t: TemplateInput): SatoriNode {
  const accent = t.variant % 2 === 0 ? t.primary : t.secondary;
  const barTop = t.variant % 3 === 2;
  return h(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `${accent}14`,
      fontFamily: 'Plus Jakarta Sans',
    },
    h(
      'div',
      {
        display: 'flex',
        flexDirection: barTop ? 'column' : 'row',
        width: 1040,
        height: 740,
        background: '#ffffff',
        borderRadius: 48,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(20,10,60,0.12)',
      },
      h('div', barTop ? { display: 'flex', width: '100%', height: 26, background: accent } : { display: 'flex', width: 26, height: '100%', background: accent }),
      h(
        'div',
        { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '70px 80px', boxSizing: 'border-box' },
        h(
          'div',
          { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
          h('div', { display: 'flex', fontSize: 26, fontWeight: 700, color: accent, letterSpacing: 3, textTransform: 'uppercase' }, t.topicLabel ?? t.city ?? 'Update'),
          t.logo ? img(t.logo, { objectFit: 'contain' }, 120, 120) : null,
        ),
        h('div', { display: 'flex', fontSize: headlineSize(t.headline, 84), fontWeight: 800, lineHeight: 1.06, letterSpacing: -2, color: '#0B0B14' }, t.headline),
        h(
          'div',
          { display: 'flex', flexDirection: 'column' },
          h('div', { display: 'flex', fontSize: 36, fontWeight: 800, color: '#0B0B14' }, t.businessName),
          h('div', { display: 'flex', fontSize: 25, color: '#6B6B80', marginTop: 6 }, [t.topicLabel ? t.city : null, t.tagline].filter(Boolean).join('  ·  ') || ' '),
        ),
      ),
    ),
  );
}
