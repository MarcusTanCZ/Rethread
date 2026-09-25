/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { 50: '#eef4ff', 100: '#dbe6fe', 500: '#3b6fd8', 600: '#2c58b8', 700: '#244795' },
        holding: { 50: '#ecfdf3', 500: '#16a34a', 700: '#15803d' },
        shaky: { 50: '#fffbeb', 500: '#d97706', 700: '#b45309' },
        broken: { 50: '#fef2f2', 500: '#dc2626', 700: '#b91c1c' },
      },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'none' } },
        blink: { '0%, 80%, 100%': { opacity: '0.2' }, '40%': { opacity: '1' } },
        ping2: { '0%': { transform: 'scale(1)', opacity: '0.6' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
      },
      animation: {
        rise: 'rise 220ms ease-out both',
        blink: 'blink 1s infinite both',
        ping2: 'ping2 1s cubic-bezier(0,0,0.2,1) infinite',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Consolas', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
