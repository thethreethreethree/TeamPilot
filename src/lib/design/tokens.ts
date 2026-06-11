/**
 * ELOSTATE design tokens — canonical source for component-level color access.
 *
 * For Tailwind utility usage (`bg-ember-400`, `text-ink-200`) see
 * `tailwind.config.ts` which extends the palette from this file.
 *
 * For CSS variable usage (`var(--ember-400)`) see `globals.css`.
 *
 * For the human-readable identity map, see `docs/BRAND.md` — this file
 * is the machine mirror, kept in lockstep.
 *
 * Design governance: the ELOSTATE logo (amber lightbulb-with-e on matte
 * black). The visual identity is mono-amber: warm yellow primary on
 * near-black surfaces, with white text. No red, no cyan, no navy —
 * those were the prior Iron Man identity and were dropped on 2026-06-12
 * when the logo became design governance.
 *
 * No slogan tagline is encoded here. An earlier version of this file
 * referenced "Problem Solving (System) for Teams"; the user has since
 * confirmed that is NOT the canonical brand slogan. The slot stays
 * empty until provided.
 *
 * Two scales:
 *   - ember : the bulb. Warm amber-yellow, used for brand + accents.
 *   - ink   : the field. Near-white through matte-black grayscale.
 *
 * Functional roles (warning / error) use deeper ember shades — burnt
 * amber instead of red, so the palette stays mono-warm.
 */

// ─── Brand colors ─────────────────────────────────────────────

/** The lightbulb yellow. 400 is the canonical brand primary — matches
 *  the stroke color in icon.svg and the logo JPEG. */
export const ember = {
  50:  "#FFFDF0",
  100: "#FEF9C3",
  200: "#FEF08A",
  300: "#FDE047",
  400: "#FACC15", // ← brand primary (the bulb)
  500: "#EAB308", // ← primary hover / pressed
  600: "#CA8A04",
  700: "#A16207",
  800: "#854D0E", // ← warning / error semantic (burnt amber, no red)
  900: "#713F12",
} as const;

/** The matte-black field. 950 is the canonical app background in dark
 *  mode; 50 is the canonical cream background in light mode. */
export const ink = {
  50:  "#FAFAFA",
  100: "#F4F4F5",
  200: "#E4E4E7",
  300: "#D4D4D8",
  400: "#A1A1AA",
  500: "#71717A",
  600: "#52525B",
  700: "#3F3F46",
  800: "#27272A",
  900: "#18181B",
  950: "#09090B", // ← matte black base
} as const;

// ─── Semantic palette ─────────────────────────────────────────
// All semantic colors stay inside the ember+ink palette. No red.

export const semantic = {
  success: ember[300], // bright bulb — "validated/held"
  warning: ember[500], // primary-hover amber — "attention"
  error:   ember[800], // burnt amber — "danger" (no red, per logo governance)
  info:    ember[400], // brand amber — "system speaking"
} as const;

// ─── Glow shadows ─────────────────────────────────────────────
// The bulb-glow effect is the brand's signature ambient treatment.

export const glow = {
  ember:       "0 0 24px rgba(250, 204, 21, 0.35)",
  emberStrong: "0 0 48px rgba(250, 204, 21, 0.55)",
  emberSoft:   "0 0 16px rgba(250, 204, 21, 0.20)",
} as const;

// ─── Gradients ────────────────────────────────────────────────
// Sparing use only — hero treatments, the install splash, the lit-bulb
// background ambient. Always ember-on-ink direction.

export const gradient = {
  emberWarm:
    "linear-gradient(135deg, #FDE047 0%, #FACC15 50%, #EAB308 100%)",
  emberSoft:
    "linear-gradient(135deg, #FACC15 0%, #CA8A04 100%)",
  /** Radial bulb-glow — used behind the mark on landing/login hero. */
  bulbGlow:
    "radial-gradient(circle at center, rgba(250,204,21,0.30) 0%, rgba(250,204,21,0.10) 35%, transparent 70%)",
} as const;

// ─── Spacing & radii ─────────────────────────────────────────

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

// ─── Motion ─────────────────────────────────────────────────

export const motion = {
  durations: {
    fast: "150ms",
    standard: "200ms",
    slow: "400ms",
  },
  easings: {
    out: "cubic-bezier(0.2, 0, 0, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

// ─── Type ─────────────────────────────────────────────────

export type Palette = {
  ember: typeof ember;
  ink: typeof ink;
};

export const palette: Palette = { ember, ink };
