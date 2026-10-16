/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cc-dark': '#0b0f19',
        'cc-panel': '#111827',
        'cc-border': '#263244',
        'cc-accent': '#ffcb70',
      },
    },
  },
  plugins: [],
};
