import { h, headlineSize, img, type SatoriNode, type TemplateInput, HEIGHT, WIDTH } from './h.js';

/** Template 1: bold headline on a brand-colour gradient with abstract shapes. */
export function gradientTemplate(t: TemplateInput): SatoriNode {
  const angles = [135, 160, 115];
  const angle = angles[t.variant % angles.length];
  const [a, b] = t.variant % 2 === 0 ? [t.primary, t.secondary] : [t.secondary, t.primary];
  const flip = t.variant % 2 === 1;
  return h(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      position: 'relative',
      backgroundImage: `linear-gradient(${angle}deg, ${a} 0%, ${b} 100%)`,
      color: t.text,
      fontFamily: 'Plus Jakarta Sans',
      overflow: 'hidden',
    },
    h('div', { position: 'absolute', width: 520, height: 520, borderRadius: 9999, background: 'rgba(255,255,255,0.12)', top: -160, [flip ? 'left' : 'right']: -140 }),
    h('div', { position: 'absolute', width: 360, height: 360, borderRadius: 9999, border: '3px solid rgba(255,255,255,0.22)', bottom: -120, [flip ? 'right' : 'left']: 120 }),
    h('div', { position: 'absolute', width: 900, height: 260, borderRadius: 9999, border: '2px solid rgba(255,255,255,0.18)', top: 330, left: 150, transform: 'rotate(-12deg)' }),
    h('div', { position: 'absolute', width: 22, height: 22, borderRadius: 9999, background: 'rgba(255,255,255,0.7)', top: 300, [flip ? 'left' : 'right']: 190 }),
    h(
      'div',
      { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '80px 90px', width: WIDTH, height: HEIGHT, boxSizing: 'border-box' },
      h(
        'div',
        { display: 'flex', alignItems: 'center' },
        t.topicLabel
          ? h('div', { display: 'flex', padding: '10px 26px', borderRadius: 9999, background: 'rgba(255,255,255,0.2)', fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }, t.topicLabel)
          : null,
      ),
      h('div', { display: 'flex', fontSize: headlineSize(t.headline, 92), fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }, t.headline),
      h(
        'div',
        { display: 'flex', alignItems: 'center', gap: 26 },
        t.logo ? img(t.logo, { borderRadius: 24, background: '#ffffff', padding: 10, objectFit: 'contain' }, 110, 110) : null,
        h(
          'div',
          { display: 'flex', flexDirection: 'column' },
          h('div', { display: 'flex', fontSize: 40, fontWeight: 800 }, t.businessName),
          h('div', { display: 'flex', fontSize: 26, fontWeight: 400, opacity: 0.85 }, [t.city, t.tagline].filter(Boolean).join('  ·  ') || ' '),
        ),
      ),
    ),
  );
}
