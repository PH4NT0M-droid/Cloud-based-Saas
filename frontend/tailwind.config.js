/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1fbfa',
          100: '#d7f5f2',
          200: '#aee9e3',
          300: '#78d7cf',
          400: '#42c0b8',
          500: '#1d9f9a',
          600: '#177f7b',
          700: '#176462',
          800: '#165251',
          900: '#154443'
        },
        accent: {
          100: '#fff4df',
          300: '#ffd27a',
          500: '#f5ab2a',
          700: '#b8700e'
        }
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
