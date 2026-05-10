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
          50: "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d7ff",
          300: "#a4bcff",
          400: "#7a96ff",
          500: "#5470ff",
          600: "#3a4ff7",
          700: "#2d3de3",
          800: "#2633b8",
          900: "#253091",
          950: "#161b55",
        },
        surface: {
          50: "#f8f9fc",
          100: "#f1f2f8",
          200: "#e4e7f3",
          300: "#cdd2e8",
          400: "#b0b8d9",
          500: "#8f9cc8",
          600: "#6e7ab3",
          700: "#5a6399",
          800: "#4a527d",
          900: "#404666",
          950: "#292d44",
        },
        dark: {
          50: "#f6f7fb",
          100: "#eceef5",
          200: "#d5d9eb",
          300: "#b2bad6",
          400: "#8995bc",
          500: "#6775a3",
          600: "#535f8a",
          700: "#444e70",
          800: "#3b425e",
          900: "#343a50",
          950: "#1a1d2e",
          1000: "#12141f",
          1100: "#0c0d16",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-brand": "linear-gradient(135deg, #3a4ff7 0%, #7a96ff 100%)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(90, 112, 255, 0.3)",
        "glow-sm": "0 0 10px rgba(90, 112, 255, 0.2)",
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
