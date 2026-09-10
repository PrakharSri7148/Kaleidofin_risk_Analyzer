/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Kaleidofin brand — navy primary, teal secondary (from the logo).
        brand: {
          DEFAULT: "#17506E",
          600: "#124259",
          700: "#0E3547",
          50: "#EAF1F4",
          100: "#D3E3E8",
        },
        teal: {
          DEFAULT: "#2FB2B5",
          600: "#259699",
        },
        // Neutral surfaces — warm-neutral "color grading" from the inspo.
        ink: "#1B2A32",
        muted: "#6B7680",
        faint: "#9AA4AC",
        hairline: "#E5E3DC",
        frame: "#E7E5DF", // whitish outer background behind the floating panels
        paper: "#F4F3EF", // the light sidebar panel
        tray: "#EBE9E3", // the soft content tray inside the main panel
        panel: "#FFFFFF",
        rail: "#122A33", // dark icon rail
        hero: "#10242E", // dark "Ask Kaleido" card
        pop: "#F0663C",
        // functional decision colors only
        danger: "#C23B32",
        warn: "#B07414",
        ok: "#3C7A4B",
      },
      fontFamily: {
        sans: ['"Public Sans"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
