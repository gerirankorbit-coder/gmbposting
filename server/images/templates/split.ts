import { h, headlineSize, img, initials, type SatoriNode, type TemplateInput, HEIGHT, WIDTH } from './h.js';

/** Template 2: split layout with a large logo panel. */
export function splitTemplate(t: TemplateInput): SatoriNode {
  const logoLeft = t.variant % 2 === 0;
  const panel = h(
    'div',
    {
      display: 'flex',
      width: 470,
      height: HEIGHT,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      background: '#ffffff',
      position: 'relative',
    },
    h('div', { position: 'absolute', width: 380, height: 380, borderRadius: 9999, background: `${t.secondary}22` }),
    t.logo
      ? img(t.logo, { objectFit: 'contain' }, 300, 300)
      : h(
          'div',
          { display: 'flex', width: 260, height: 260, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', background: t.primary, color: t.text, fontSize: 110, fontWeight: 800 },
          initials(t.businessName),
        ),
  );
  const content = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      width: WIDTH - 470,
      height: HEIGHT,
      boxSizing: 'border-box',
      padding: '70px 80px',
      backgroundImage: `linear-gradient(${logoLeft ? 160 : 200}deg, ${t.primary} 0%, ${t.secondary} 100%)`,
      color: t.text,
      position: 'relative',
    },
    h('div', { position: 'absolute', width: 240, height: 240, borderRadius: 9999, border: '3px solid rgba(255,255,255,0.25)', top: -80, right: -60 }),
    t.topicLabel ? h('div', { display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.85, marginBottom: 22 }, t.topicLabel) : null,
    h('div', { display: 'flex', fontSize: headlineSize(t.headline, 76), fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }, t.headline),
    h('div', { display: 'flex', width: 90, height: 8, borderRadius: 9999, background: 'rgba(255,255,255,0.75)', marginTop: 40, marginBottom: 34 }),
    h('div', { display: 'flex', fontSize: 36, fontWeight: 800 }, t.businessName),
    h('div', { display: 'flex', fontSize: 25, opacity: 0.85, marginTop: 6 }, [t.city, t.tagline].filter(Boolean).join('  ·  ') || ' '),
  );
  return h(
    'div',
    { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: logoLeft ? 'row' : 'row-reverse', fontFamily: 'Plus Jakarta Sans' },
    panel,
    content,
  );
}
