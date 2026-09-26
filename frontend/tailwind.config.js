/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5', // Indigo-600, unico accento
        secondary: '#1e293b', // Slate-800
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '68ch',
            a: { color: '#4f46e5' },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            code: { backgroundColor: '#eef2ff', borderRadius: '0.375rem', padding: '0.125rem 0.375rem', fontWeight: '500' },
            pre: { backgroundColor: '#1e293b' },
            'pre code': { backgroundColor: 'transparent', padding: '0' },
          },
        },
        invert: {
          css: {
            code: { backgroundColor: '#374151' },
            pre: { backgroundColor: '#111827' },
          },
        },
      },
    },
  },
  plugins: [typography],
}
