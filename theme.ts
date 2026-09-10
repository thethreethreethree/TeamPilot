/**
 * theme.ts — the token file the design gate (G3) audits.
 *
 * HAND-AUTHORED, NOT GENERATED, deliberately. token-gen was run first and its
 * output inspected; it could not express this brand, which was proven by
 * measurement rather than assumed:
 *
 *     generated light primary   #806700   L=0.523 C=0.107   a muddy dark gold
 *     ratified  ember-400       #FACC15   L=0.861 C=0.173   the bulb
 *
 * The generator solves foregrounds for contrast from a seed. On a white ground
 * ember measures ~1.7:1, so its solver walked the PRIMARY down until white text
 * passed — meeting WCAG by destroying the brand colour — and emitted a red
 * `destructive` into an identity that bans red outright (docs/BRAND.md §4.3).
 *
 * 03-DESIGN-BLUEPRINT.md §1 prescribes exactly this remedy: "If it cannot reach
 * the brand colour, add a semantic token pair — the sanctioned mechanism —
 * defining the value explicitly... Adding a token pair is normal work."
 *
 * ── THERE IS ONLY A DARK PALETTE, AND THAT IS THE POINT ─────────────────────
 * The app sets userInterfaceStyle: "dark" (app.json). BRAND.md calls the
 * bulb-on-matte-black the canonical logo state. No `light` key is declared here
 * because none exists: a second scheme nobody verifies is worse than one scheme
 * that is right, and declaring an unused one would have the gate audit a palette
 * that never reaches a screen.
 *
 * ── MIRROR OBLIGATION ───────────────────────────────────────────────────────
 * src/lib/tokens/index.js holds the same values in CommonJS, because
 * tailwind.config.js must `require()` them and cannot load TypeScript. That file
 * is the app's runtime source; THIS file is what the gate reads. Change one,
 * change both — recorded as a re-apply item in DESIGN-CONTRACT.md §12.
 *
 * Every ratio below was measured with tools/lib/wcag.mjs, truncated never
 * rounded (4.499 fails 4.5).
 */

export const colors = {
  dark: {
    // ── surfaces: ink, the matte-black field (BRAND.md §4.2) ──
    background: "#09090B", // ink-950
    foreground: "#FAFAFA", // ink-50 · 19.06 on background — AAA
    card: "#18181B", // ink-900
    "card-foreground": "#FAFAFA", // 16.97 on card — AAA
    popover: "#18181B",
    "popover-foreground": "#FAFAFA", // 16.97 on popover — AAA

    // ── brand: ember, the bulb (BRAND.md §4.1) ──
    primary: "#FACC15", // ember-400
    // BRAND.md §7: white on ember measures 1.46 and FAILS. The web fixes that
    // with a CSS cascade rule; there is no cascade on device, so it is pinned.
    "primary-foreground": "#09090B", // 12.99 on primary — AAA

    secondary: "#27272A", // ink-800
    "secondary-foreground": "#FAFAFA", // 15.29 on secondary — AAA
    accent: "#27272A",
    "accent-foreground": "#FAFAFA", // 15.29 on accent — AAA

    muted: "#27272A",
    // DEVIATION from BRAND.md §4.2, which assigns ink-500 as text-muted. Measured
    // on matte black ink-500 is 4.11 and on the raised surface 3.66 — both FAIL.
    "muted-foreground": "#A1A1AA", // ink-400 · 7.76 on background — AA

    // DEVIATION from BRAND.md §4.3, which mandates ember-800 for error. As TEXT
    // on matte black ember-800 is 2.9 and ember-700 is 4.04 — both FAIL.
    // ember-600 is the first shade that clears; ember-800 keeps its brand role
    // as an error FILL, where ink-50 on it measures 6.56 and passes.
    destructive: "#CA8A04", // ember-600 · 6.77 on background — AA

    // DEVIATION from BRAND.md §5, which maps the dark border to ink-800. At 1.33
    // that is fine for a decorative divider (WCAG 1.4.11 covers boundaries you
    // must IDENTIFY, not plain rules) but fails 3:1 for a control outline.
    border: "#27272A", // ink-800 · dividers only
    input: "#71717A", // ink-500 · 4.11 on background — control boundaries
    ring: "#FACC15", // ember-400 · 12.99 on background — focus, and the brand glow

    // ── sidebar set: no sidebar exists on a phone. Mapped onto the same surfaces
    // so the audit's fixed pair list resolves rather than silently skipping. ──
    sidebar: "#18181B",
    "sidebar-foreground": "#FAFAFA",
    "sidebar-primary": "#FACC15",
    "sidebar-primary-foreground": "#09090B",
    "sidebar-accent": "#27272A",
    "sidebar-accent-foreground": "#FAFAFA",
    "sidebar-border": "#27272A",
  },
} as const;

/** The one palette. Named so call sites read as intent, not as a scheme lookup. */
export const palette = colors.dark;

/** 4dp base grid. */
export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 24,
  6: 32, 7: 48, 8: 64, 9: 96, 10: 128,
} as const;

/** 1.25 major third from a 16dp base (DESIGN-CONTRACT.md scaleRatio). */
export const fontSize = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
  "2xl": 25, "3xl": 31, "4xl": 39, "5xl": 49, "6xl": 61, "7xl": 76,
} as const;

/** Derived from one base radius of 0.75rem (DESIGN-CONTRACT.md radius). */
export const radius = {
  sm: 7, md: 10, lg: 12, xl: 17, "2xl": 22, "3xl": 26, "4xl": 31,
} as const;

export const fontFamily = {
  body: "Inter_400Regular",
  emphasis: "Inter_500Medium",
  strong: "Inter_600SemiBold",
  heading: "Inter_700Bold",
  wordmark: "Inter_900Black", // ELOSTATE wordmark — BRAND.md §2
} as const;

export type ColorToken = keyof typeof palette;

export const theme = { colors, palette, space, fontSize, radius, fontFamily } as const;
export default theme;
