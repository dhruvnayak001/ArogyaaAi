/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand palette — deep teal-blue
        primary: {
          50:  '#edfafa',
          100: '#d5f5f6',
          200: '#afecef',
          300: '#7edce2',
          400: '#16bdca',
          500: '#0694a2',
          600: '#047481',
          700: '#036672',
          800: '#05505c',
          900: '#014451',
        },
        // Accent — electric violet
        accent: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // Danger / Emergency
        danger: {
          50:  '#fff5f5',
          100: '#fed7d7',
          400: '#fc8181',
          500: '#f56565',
          600: '#e53e3e',
          700: '#c53030',
        },
        // Success
        success: {
          400: '#68d391',
          500: '#48bb78',
          600: '#38a169',
        },
        // Warning
        warning: {
          400: '#f6ad55',
          500: '#ed8936',
          600: '#dd6b20',
        },
        // Dark theme surfaces
        dark: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          800: '#1e293b',
          850: '#172033',
          900: '#0f172a',
          950: '#080d1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(6, 148, 162, 0.4)',
        'glow-accent':  '0 0 20px rgba(139, 92, 246, 0.4)',
        'glow-danger':  '0 0 20px rgba(245, 101, 101, 0.5)',
        'glass':        '0 8px 32px rgba(0, 0, 0, 0.12)',
        'glass-dark':   '0 8px 32px rgba(0, 0, 0, 0.4)',
        'card':         '0 4px 24px rgba(0, 0, 0, 0.08)',
        'card-dark':    '0 4px 24px rgba(0, 0, 0, 0.3)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in':      'fadeIn 0.5s ease-out',
        'slide-up':     'slideUp 0.4s ease-out',
        'slide-down':   'slideDown 0.4s ease-out',
        'slide-right':  'slideRight 0.4s ease-out',
        'pulse-glow':   'pulseGlow 2s infinite',
        'float':        'float 3s ease-in-out infinite',
        'spin-slow':    'spin 3s linear infinite',
        'bounce-soft':  'bounceSoft 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',      opacity: '1' },
        },
        slideRight: {
          '0%':   { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',      opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(6, 148, 162, 0.3)' },
          '50%':      { boxShadow: '0 0 30px rgba(6, 148, 162, 0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      backgroundImage: {
        'gradient-radial':       'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':        'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-mesh':             "url('/src/assets/hero-mesh.svg')",
        'mesh-primary':          'radial-gradient(at 40% 20%, hsla(188,85%,30%,0.4) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(263,80%,60%,0.3) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
};
