import { cn } from '@/lib/utils';

/** Thin orbital ellipse drawn behind page headers. */
export function OrbitLine({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 220"
      fill="none"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute', className)}
    >
      <defs>
        <linearGradient id="orbit-stroke" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#A21CAF" stopOpacity="0.25" />
          <stop offset="1" stopColor="#D946EF" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <ellipse
        cx="400"
        cy="110"
        rx="390"
        ry="70"
        transform="rotate(-6 400 110)"
        stroke="url(#orbit-stroke)"
        strokeWidth="1.2"
      />
      <circle cx="742" cy="62" r="4" fill="#D946EF" fillOpacity="0.55" />
    </svg>
  );
}

const BUBBLES = [
  { size: 140, top: '6%', left: '4%', delay: '0s', slow: false },
  { size: 72, top: '58%', left: '12%', delay: '-6s', slow: true },
  { size: 190, top: '18%', left: '78%', delay: '-3s', slow: true },
  { size: 54, top: '70%', left: '68%', delay: '-9s', slow: false },
  { size: 96, top: '-4%', left: '46%', delay: '-12s', slow: false },
];

/** Slowly drifting glass bubbles. Motion stops under prefers-reduced-motion (globals.css). */
export function Bubbles({ className, count = BUBBLES.length }: { className?: string; count?: number }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {BUBBLES.slice(0, count).map((b, i) => (
        <span
          key={i}
          className={cn('bubble', b.slow ? 'animate-drift-slow' : 'animate-drift')}
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            animationDelay: b.delay,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}
