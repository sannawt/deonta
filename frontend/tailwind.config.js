/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans:  ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono:  ["'DM Mono'", "'Fira Code'", "monospace"],
        serif: ["'Source Serif 4'", "Georgia", "serif"],
      },
      colors: {
        blue:    "var(--blue)",
        "blue-dim": "var(--blue-dim)",
        cloud: {
          dark:  "var(--cloud-dark)",
          mid:   "var(--cloud-mid)",
          light: "var(--cloud-light)",
          edge:  "var(--cloud-edge)",
        },
      },
    },
  },
  plugins: [],
};
