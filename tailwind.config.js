/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark2026: {
          bg: '#121314',
          sidebar: '#191A1B',
          card: '#202122',
          surface: '#242526',
          border: '#2A2B2C',
          borderSubtle: '#333536',
          accent: '#297AA0',
          accentHover: '#2B7DA3',
          accentActive: '#3994BC',
          accentMuted: '#1E3A47',
          highlight: '#48A0C7',
          selection: '#276782',
          badge: '#307E9F',
          text: '#bfbfbf',
          textBright: '#ededed',
          muted: '#8C8C8C',
          disabled: '#555555',
        },
        // Backwards compatibility alias mapped directly to 2026-dark
        obsidian: {
          bg: '#121314',
          sidebar: '#191A1B',
          header: '#191A1B',
          border: '#2A2B2C',
          accent: '#297AA0',
          accentHover: '#2B7DA3',
          text: '#bfbfbf',
          muted: '#8C8C8C',
        },
      },
    },
  },
  plugins: [],
};
