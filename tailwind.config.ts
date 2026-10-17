import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          electric: "#FF6B00",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#F9FAFB",
          muted: "#F3F4F6",
        },
        charcoal: {
          DEFAULT: "#0F172A",
          deep: "#111827",
          light: "#1E293B",
        },
      },
    },
  },
  plugins: [],
};

export default config;
