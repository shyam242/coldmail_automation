/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#ff7a18",
        bg: "#fffaf5",
        textDark: "#2d1e12",
      },
    },
  },
  plugins: [],
};
