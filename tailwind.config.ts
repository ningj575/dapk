import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        surface: "hsl(var(--surface))",
        "text-tertiary": "hsl(var(--text-tertiary))"
      },
      fontFamily: {
        display: ["var(--font-display)", "Noto Sans SC", "sans-serif"],
        sans: ["Noto Sans SC", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"]
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" }
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        }
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        "fade-in": "fade-in .45s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
