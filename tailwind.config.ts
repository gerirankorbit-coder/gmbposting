import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        orbit: {
          bg: '#F8F5FF',
          glow1: '#EDE4FF',
          glow2: '#F5E8FF',
          line: '#E9E1FF',
          violet: '#7C3AED',
          primary: '#8B2CF5',
          'primary-dark': '#7A1FE0',
          fuchsia: '#A21CAF',
          pink: '#D946EF',
          heading: '#0B0B14',
          body: '#3F3F52',
          muted: '#6B6B80',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      backgroundImage: {
        'orbit-gradient': 'linear-gradient(90deg, #7C3AED 0%, #A21CAF 60%, #D946EF 100%)',
        'orbit-gradient-soft':
          'linear-gradient(90deg, rgba(124,58,237,0.12) 0%, rgba(162,28,175,0.1) 60%, rgba(217,70,239,0.12) 100%)',
      },
      boxShadow: {
        glow: '0 10px 40px -10px rgba(139,44,245,0.35)',
        'glow-strong': '0 14px 48px -10px rgba(139,44,245,0.55)',
        glass: '0 8px 32px -12px rgba(76,29,149,0.18)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '33%': { transform: 'translate3d(18px, -26px, 0)' },
          '66%': { transform: 'translate3d(-14px, 14px, 0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        drift: 'drift 18s ease-in-out infinite',
        'drift-slow': 'drift 26s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
