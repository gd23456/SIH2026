/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Warm, dignified artisan palette (high legibility, large-touch friendly)
        clay: {
          50: "#faf6f0",
          100: "#f3e9dc",
          200: "#e9d9c3",
          300: "#dcc0a0",
          400: "#c99f74",
          500: "#b97f4e",
          600: "#a4652f",
          700: "#874f27",
          800: "#6d4124",
          900: "#5a3720",
        },
        indigo: {
          brand: "#2b2a5c",
        },
        haldi: "#e8a13a",
        leaf: "#3f7d5a",
      },
      fontFamily: {
        sans: ["'Poppins'", "system-ui", "sans-serif"],
        display: ["'Poppins'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(90, 55, 32, 0.35)",
      },
    },
  },
  plugins: [],
};
