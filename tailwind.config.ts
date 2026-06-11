import type { Config } from "tailwindcss";
import { ember, ink } from "./src/lib/design/tokens";

/**
 * ELOSTATE Tailwind config — dual-mode (light + dark) Lightbulb identity.
 *
 * Mode switching: `darkMode: ["class", '[data-theme="dark"]']` means
 * `dark:` variants activate when the `<html>` element has `data-theme="dark"`.
 * The theme provider sets that attribute based on user preference.
 *
 * Color philosophy: the brand is mono-amber. `ember` is the only brand
 * color and reads identically in both modes (it sits on dark or light
 * surfaces and stays warm). `ink` is the field — matte-black in dark
 * mode, near-white in light mode. The surface tokens (`bg-base`,
 * `bg-surface`) swap via CSS variables in globals.css.
 *
 * No red, no cyan, no navy. Those tokens were the prior Iron Man
 * identity and were dropped 2026-06-12 when the logo became design
 * governance. See docs/BRAND.md for the rationale.
 *
 * Back-compat aliases kept temporarily so the sweep can be incremental:
 *   `brand`   → ember  (was: crimson)
 *   `accent`  → ember  (was: gold)
 *   `gold`    → ember  (legacy alias; same scale now)
 *   `crimson` → REMOVED; literal #C8232C usages must migrate
 *   `arc`     → REMOVED
 *   `navy`    → ink    (legacy alias on the surface scale)
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
        // Canonical brand scales — the only two that exist now.
        ember,
        ink,
        // Semantic aliases — all pointing at ember.
        brand: ember,
        accent: ember,
        // Back-compat aliases so existing `bg-gold-400`, `text-gold-300`
        // etc. render without a sweep. These literally point at the
        // ember scale — they exist for migration ergonomics only.
        gold: ember,
        navy: ink,
        surface: ink,
        dark: {
          50: ink[50],
          100: ink[100],
          200: ink[200],
          300: ink[300],
          400: ink[400],
          500: ink[500],
          600: ink[600],
          700: ink[700],
          800: ink[800],
          900: ink[900],
          950: ink[950],
          1000: ink[950],
          1100: ink[950],
        },
        // ─── Theme-aware semantic tokens (mode-switching) ─────────
        // These resolve via CSS variables defined in globals.css.
        //   bg-base · bg-surface · bg-surface-raised
        //   border-default · border-strong
        //   text-primary · text-secondary · text-muted
        //   text-brand · text-accent (contrast-aware brand text)
        base: "rgb(var(--bg-base) / <alpha-value>)",
        "surface-card": "rgb(var(--bg-surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--bg-surface-raised) / <alpha-value>)",
      },
      borderColor: {
        DEFAULT: "rgb(var(--border-default) / <alpha-value>)",
        default: "rgb(var(--border-default) / <alpha-value>)",
        strong: "rgb(var(--border-strong) / <alpha-value>)",
      },
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
        // Back-compat — old code uses text-accent-text and
        // text-active-text. Both now point at brand-text since the
        // palette collapsed to mono-amber.
        "accent-text": "rgb(var(--brand-text) / <alpha-value>)",
        "active-text": "rgb(var(--brand-text) / <alpha-value>)",
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
        "gradient-ember": `linear-gradient(135deg, ${ember[300]} 0%, ${ember[400]} 50%, ${ember[600]} 100%)`,
        "gradient-bulb-glow": `radial-gradient(circle at center, rgba(250,204,21,0.30) 0%, rgba(250,204,21,0.10) 35%, transparent 70%)`,
        // Back-compat aliases — gradient-crimson / gradient-gold / etc.
        // remap to the new ember gradient so legacy class names still
        // produce the correct (amber) result during the sweep.
        "gradient-crimson": `linear-gradient(135deg, ${ember[300]} 0%, ${ember[400]} 50%, ${ember[600]} 100%)`,
        "gradient-gold": `linear-gradient(135deg, ${ember[300]} 0%, ${ember[400]} 50%, ${ember[600]} 100%)`,
      },
      boxShadow: {
        glow: `0 0 24px rgba(250, 204, 21, 0.35)`,
        "glow-ember": `0 0 24px rgba(250, 204, 21, 0.35)`,
        "glow-ember-strong": `0 0 48px rgba(250, 204, 21, 0.55)`,
        "glow-ember-soft": `0 0 16px rgba(250, 204, 21, 0.20)`,
        // Back-compat aliases — every old glow utility now produces
        // the same amber glow.
        "glow-crimson": `0 0 24px rgba(250, 204, 21, 0.35)`,
        "glow-gold": `0 0 24px rgba(250, 204, 21, 0.35)`,
        "glow-arc": `0 0 24px rgba(250, 204, 21, 0.35)`,
        "glow-arc-strong": `0 0 48px rgba(250, 204, 21, 0.55)`,
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "card-light": "0 1px 3px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
