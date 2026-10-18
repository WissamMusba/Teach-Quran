import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      fold: "280px", // Galaxy Z Fold outer display & ultra-narrow phones
      xs: "375px",   // Standard compact phones (iPhone SE, mini)
      sm: "640px",   // Large phones & unfolded foldables (Fold inner screen)
      md: "768px",   // Tablets & small laptops
      lg: "1024px",  // Desktop
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Barlow", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Barlow Condensed", "Oswald", "sans-serif"],
        athletic: ["var(--font-display)", "Barlow Condensed", "Impact", "sans-serif"],
      },
      scale: {
        // Referenced by product/category media zoom; not in Tailwind defaults.
        108: "1.08",
      },
      colors: {
        pitch: {
          DEFAULT: "#050505",
          950: "#000000",
          900: "#08080A",
          850: "#0E0E12",
          800: "#141418",
          700: "#1C1C22",
          600: "#27272E",
          border: "#26262B",
          borderHover: "#383842",
        },
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#ff6600",
          600: "#ff5500", // Vibrant JBL electric orange
          700: "#ea4600",
          800: "#c83600",
          900: "#9e2800",
          vibrant: "#FF5500",
          glow: "#FF6600",
        },
      },
      boxShadow: {
        "orange-glow": "0 0 25px -3px rgba(255, 85, 0, 0.35)",
        "orange-glow-sm": "0 0 12px -2px rgba(255, 85, 0, 0.4)",
        "card-dark": "0 10px 30px -10px rgba(0, 0, 0, 0.7)",
      },
    },
  },
  plugins: [],
};

export default config;
