import type { Config } from "tailwindcss";
import { crimson, gold, arc, navy } from "./src/lib/design/tokens";

/**
 * ELOSTATE Tailwind config — dual-mode (light + dark) Iron Man identity.
 *
 * Mode switching: `darkMode: ["class", '[data-theme="dark"]']` means
 * `dark:` variants activate when the `<html>` element has `data-theme="dark"`.
 * The theme provider sets that attribute based on user preference.
 *
 * Color philosophy: the brand triad (crimson, gold, arc) is mode-agnostic.
 * Only the surface scale (`base`, `surface`, `border`, `text-*`) swaps.
 * Surface tokens are exposed as CSS-variable-backed utilities so the same
 * `bg-base` class produces a navy fill in dark mode and a slate fill in light.
 *
 * See docs/BRAND.md for the full identity map and §9.5 for the dual-mode spec.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand triad — Iron Man inspired, mode-agnostic
        crimson,
        gold,
        arc,
        navy,
        // Aliases for back-compat / semantic readability
        brand: crimson,
        accent: gold,
        active: arc,
        surface: navy,
        dark: {
          50: navy[50],
          100: navy[100],
          200: navy[200],
          300: navy[300],
          400: navy[400],
          500: navy[500],
          600: navy[600],
          700: navy[700],
          800: navy[800],
          900: navy[800],
          950: navy[800],
          1000: navy[800],
          1100: navy[900],
        },
        // ─── Theme-aware semantic tokens (mode-switching) ─────────
        // These resolve via CSS variables defined in globals.css.
        // Use these in components that should follow the active theme:
        //   bg-base · bg-surface · bg-surface-raised
        //   border-default · border-strong
        //   text-primary · text-secondary · text-muted
        //   text-brand · text-accent · text-active   (contrast-aware brand text)
        base: "rgb(var(--bg-base) / <alpha-value>)",
        "surface-card": "rgb(var(--bg-surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--bg-surface-raised) / <alpha-value>)",
      },
      borderColor: {
        DEFAULT: "rgb(var(--border-default) / <alpha-value>)",
        default: "rgb(var(--border-default) / <alpha-value>)",
        strong: "rgb(var(--border-strong) / <alpha-value>)",
      },
      // `divide-default` for list separators (`divide-y divide-default`).
      // Tailwind treats divideColor as a distinct namespace from borderColor;
      // without this, `divide-default` silently falls back to `currentColor`.
      divideColor: {
        DEFAULT: "rgb(var(--border-default) / <alpha-value>)",
        default: "rgb(var(--border-default) / <alpha-value>)",
        strong: "rgb(var(--border-strong) / <alpha-value>)",
      },
      textColor: {
        primary: "rgb(var(--text-primary) / <alpha-value>)",
        secondary: "rgb(var(--text-secondary) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        brand: "rgb(var(--brand-text) / <alpha-value>)",
        "accent-text": "rgb(var(--accent-text) / <alpha-value>)",
        "active-text": "rgb(var(--active-text) / <alpha-value>)",
      },
      backgroundColor: {
        base: "rgb(var(--bg-base) / <alpha-value>)",
        surface: "rgb(var(--bg-surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--bg-surface-raised) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "monospace"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest: "0.15em",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-crimson": `linear-gradient(135deg, ${crimson[400]} 0%, ${crimson[500]} 60%, ${crimson[700]} 100%)`,
        "gradient-gold": `linear-gradient(135deg, ${gold[300]} 0%, ${gold[400]} 45%, ${gold[600]} 100%)`,
        "gradient-reactor": `radial-gradient(circle, #FFFFFF 0%, ${arc[200]} 30%, ${arc[400]} 60%, ${arc[700]} 100%)`,
      },
      boxShadow: {
        glow: `0 0 24px rgba(200, 35, 44, 0.35)`,
        "glow-crimson": `0 0 24px rgba(200, 35, 44, 0.35)`,
        "glow-gold": `0 0 20px rgba(232, 181, 58, 0.30)`,
        "glow-arc": `0 0 28px rgba(94, 200, 224, 0.40)`,
        "glow-arc-strong": `0 0 48px rgba(94, 200, 224, 0.55)`,
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "card-light": "0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
