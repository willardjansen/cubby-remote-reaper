/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        reaper: {
          bg: '#1a1a1a',
          surface: '#252525',
          accent: '#333333',
          highlight: '#ff69b4',
          text: '#e0e0e0',
          muted: '#94a3b8',
        }
      }
    },
  },
  plugins: [],
}
