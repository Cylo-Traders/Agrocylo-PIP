import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Agricultural / earth-tone palette ──
        soil: {
          50: '#faf6f0',
          100: '#f0e8d8',
          200: '#e0cfb0',
          300: '#c8a97a',
          400: '#b3905a',
          500: '#9c7740',
          600: '#7d5e34',
          700: '#65492c',
          800: '#543d29',
          900: '#4a3525',
          950: '#2a1c12',
        },
        leaf: {
          50: '#f2f9f0',
          100: '#def0d9',
          200: '#bee0b5',
          300: '#95c987',
          400: '#6dae5d',
          500: '#4d933e',
          600: '#3a762e',
          700: '#2f5f26',
          800: '#274c21',
          900: '#223f1d',
          950: '#0d2210',
        },
        amber: {
          50: '#fffdf0',
          100: '#fef8d0',
          200: '#fdf0a0',
          300: '#fce370',
          400: '#f9d251',
          500: '#f5bd2a',
          600: '#e0a220',
          700: '#b97e1c',
          800: '#93631e',
          900: '#78511e',
          950: '#412b0e',
        },
        bark: {
          50: '#f6f4f0',
          100: '#e8e2d7',
          200: '#d3c6b1',
          300: '#bca686',
          400: '#ab8e69',
          500: '#9c7b59',
          600: '#86674c',
          700: '#6d5140',
          800: '#5c4438',
          900: '#503c33',
          950: '#2d201c',
        },

        // ── Semantic status colors ──
        status: {
          active: {
            DEFAULT: '#3a762e',
            light: '#def0d9',
            dark: '#274c21',
          },
          funding: {
            DEFAULT: '#2563eb',
            light: '#dbeafe',
            dark: '#1e40af',
          },
          funded: {
            DEFAULT: '#4f46e5',
            light: '#e0e7ff',
            dark: '#3730a3',
          },
          inproduction: {
            DEFAULT: '#0d9488',
            light: '#ccfbf1',
            dark: '#115e59',
          },
          harvested: {
            DEFAULT: '#f5bd2a',
            light: '#fef8d0',
            dark: '#93631e',
          },
          disputed: {
            DEFAULT: '#ea580c',
            light: '#fff7ed',
            dark: '#9a3412',
          },
          resolved: {
            DEFAULT: '#059669',
            light: '#d1fae5',
            dark: '#064e3b',
          },
          settled: {
            DEFAULT: '#64748b',
            light: '#f1f5f9',
            dark: '#334155',
          },
          failed: {
            DEFAULT: '#dc2626',
            light: '#fecaca',
            dark: '#991b1b',
          },
        },
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        body: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'SF Mono', 'monospace'],
      },
      fontSize: {
        h1: [
          '2.5rem',
          { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' },
        ],
        h2: [
          '2rem',
          { lineHeight: '1.25', fontWeight: '600', letterSpacing: '-0.01em' },
        ],
        h3: ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        h4: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.5' }],
        label: [
          '0.75rem',
          {
            lineHeight: '1',
            fontWeight: '600',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          },
        ],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        campaign: '0.75rem',
      },
      boxShadow: {
        campaign:
          '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'campaign-hover':
          '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
} satisfies Config;
