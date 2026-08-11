export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          slate: '#020617',
          night: '#030711',
          mist: '#111827',
        },
      },
      boxShadow: {
        glow: '0 20px 80px rgba(30, 64, 175, 0.14)',
        panel: '0 30px 80px rgba(15, 23, 42, 0.35)',
      },
      backgroundImage: {
        'radial-glow': 'radial-gradient(circle at top left, rgba(56, 189, 248, 0.22), transparent 32%), radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.18), transparent 30%)',
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
