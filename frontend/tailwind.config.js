export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0B0E1A',
        card: '#141830',
        surface: {
          DEFAULT: '#141830',
          subtle: '#0F1326',
          hover: '#1C2242',
        },
        accent: {
          DEFAULT: '#22D3EE',
          hover: '#06B6D4',
          light: '#67E8F9',
          glow: 'rgba(34, 211, 238, 0.25)',
        },
        primary: {
          DEFAULT: '#22D3EE',
          hover: '#06B6D4',
          dark: '#0891B2',
          light: '#67E8F9',
        },
        success: {
          DEFAULT: '#34D399',
          light: 'rgba(52, 211, 153, 0.15)',
          border: 'rgba(52, 211, 153, 0.3)',
        },
        warning: {
          DEFAULT: '#FBBF24',
          light: 'rgba(251, 191, 36, 0.15)',
          border: 'rgba(251, 191, 36, 0.3)',
        },
        danger: {
          DEFAULT: '#F87171',
          light: 'rgba(248, 113, 113, 0.15)',
          border: 'rgba(248, 113, 113, 0.3)',
        },
        'text-primary': '#F8FAFC',
        'text-muted': '#94A3B8',
        'text-dim': '#64748B',
        border: {
          DEFAULT: '#252A45',
          light: 'rgba(255, 255, 255, 0.08)',
          accent: 'rgba(34, 211, 238, 0.3)',
        },
        brand: {
          dark: '#0B0E1A',
          card: '#141830',
          cyan: '#22D3EE',
          slate: '#0B0E1A',
          night: '#070A14',
          mist: '#141830',
        },
      },
      boxShadow: {
        glow: '0 0 25px rgba(34, 211, 238, 0.25)',
        panel: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'radial-glow': 'radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 32%), radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.12), transparent 30%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        drift: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(18px)' },
        },
        pulse: {
          '0%, 100%': { opacity: 0.3, transform: 'scale(0.92)' },
          '50%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        drift: 'drift 12s linear infinite',
        pulse: 'pulse 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
