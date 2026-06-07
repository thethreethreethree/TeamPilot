/**
 * ELOSTATE design tokens — canonical source for component-level color access.
 *
 * For Tailwind utility usage (`bg-crimson-500`, `text-gold-400`) see
 * `tailwind.config.ts` which extends the palette from this file.
 *
 * For CSS variable usage (`var(--crimson-500)`) see `globals.css`.
 *
 * For the human-readable identity map, see `docs/BRAND.md` — this file is
 * the machine mirror, kept in lockstep.
 *
 * Inspiration: Iron Man (2008) Marvel theatrical poster — see BRAND.md §1.
 */

// ─── Brand colors ─────────────────────────────────────────────

export const crimson = {
  50: "#FFF1F2",
  100: "#FFE3E5",
  200: "#FFB8BD",
  300: "#FF8A92",
  400: "#F75663",
  500: "#C8232C", // ← brand primary (the suit)
  600: "#A91D24", // ← primary hover
  700: "#8A1820",
  800: "#6B131A",
  900: "#4D0E14",
} as const;

export const gold = {
  50: "#FEF8E7",
  100: "#FDEEC4",
  200: "#FADD89",
  300: "#F2C94C",
  400: "#E8B53A", // ← held / validated (the helmet gold)
  500: "#D4A024",
  600: "#A6801C",
  700: "#785C14",
  800: "#4B380D",
  900: "#2C2008",
} as const;

export const arc = {
  50: "#ECFBFE",
  100: "#D0F4FA",
  200: "#A8E6F0",
  300: "#7DDCE8",
  400: "#5EC8E0", // ← AI active (the arc reactor)
  500: "#3FB1CC",
  600: "#2A8FA8",
  700: "#1F6B7E",
  800: "#144654",
  900: "#0A222A",
} as const;

export const navy = {
  50: "#E3E8F0",
  100: "#C7D1E3",
  200: "#94A3BF", // body text on dark
  300: "#5F7290",
  400: "#3C4D6A",
  500: "#2D446C",
  600: "#1F3050", // borders
  700: "#152339",
  800: "#0D1B2D", // card surface
  900: "#0A1429", // background field
} as const;

// ─── Semantic palette (built from the brand triad) ────────────

export const semantic = {
  success: gold[400], // gold means "something held"
  warning: "#FF9F1C",
  error: "#E63946", // distinct from brand crimson
  info: arc[400], // cyan means "AI active"
} as const;

// ─── Glow shadows (for box-shadow inlining) ───────────────────

export const glow = {
  crimson: "0 0 24px rgba(200, 35, 44, 0.35)",
  gold: "0 0 20px rgba(232, 181, 58, 0.30)",
  arc: "0 0 28px rgba(94, 200, 224, 0.40)",
  arcStrong: "0 0 48px rgba(94, 200, 224, 0.55)",
} as const;

// ─── Gradients (use sparingly — hero treatments only) ─────────

export const gradient = {
  goldMetallic:
    "linear-gradient(135deg, #F2C94C 0%, #E8B53A 45%, #A6801C 100%)",
  crimsonMetallic:
    "linear-gradient(135deg, #F75663 0%, #C8232C 60%, #8A1820 100%)",
  reactorCore:
    "radial-gradient(circle, #FFFFFF 0%, #A8E6F0 30%, #5EC8E0 60%, #1F6B7E 100%)",
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
  crimson: typeof crimson;
  gold: typeof gold;
  arc: typeof arc;
  navy: typeof navy;
};

export const palette: Palette = { crimson, gold, arc, navy };
