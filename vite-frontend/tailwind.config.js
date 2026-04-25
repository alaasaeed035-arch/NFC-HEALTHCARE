/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0055BB', foreground: '#ffffff' },
        clinical: { 50: '#F8FAFC', 900: '#0F172A' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
