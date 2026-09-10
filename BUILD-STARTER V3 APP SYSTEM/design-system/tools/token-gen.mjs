#!/usr/bin/env node
/**
 * token-gen — derive a complete, contrast-verified token system from the
 * DESIGN-CONTRACT. App Edition: emit a React Native theme.ts (hex colours + dp)
 * via --theme; the web-Tailwind globals.css via --out is retained as legacy.
 *
 * This is deterministic. The same contract always produces the same tokens,
 * which is what makes the design system auditable rather than improvised.
 *
 * Usage:
 *   node tools/token-gen.mjs                      # read DESIGN-CONTRACT.md
 *   node tools/token-gen.mjs --theme theme.ts     # React Native theme (App Edition)
 *   node tools/token-gen.mjs --out app/globals.css  # web CSS (legacy)
 *   node tools/token-gen.mjs --json               # tokens as JSON
 */

import fs from "node:fs";
import path from "node:path";
import {
  hexToOklch, parseColor, buildRamp, buildNeutralRamp,
  formatOklch, oklchToHex, fitChroma, nearestStep, RAMP_STEPS,
} from "./lib/oklch.mjs";
import { contrast, truncate2, grade, solveForContrast, WCAG } from "./lib/wcag.mjs";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

/* ------------------------------------------------------- read the contract */

function readContract() {
  const p = path.join(ROOT, "DESIGN-CONTRACT.md");
  if (!fs.existsSync(p)) return {};
  const src = fs.readFileSync(p, "utf8");
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return {};
  const out = {};
  // Minimal YAML: flat `key: value` and one level of `key:\n  sub: value`
  let section = null;
  for (const line of fm[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    const sub = line.match(/^\s{2,}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (sub && section) {
      out[section][sub[1]] = strip(sub[2]);
    } else if (top) {
      if (top[2] === "") {
        section = top[1];
        out[section] = {};
      } else {
        section = null;
        out[top[1]] = strip(top[2]);
      }
    }
  }
  return out;
}
// Strip a trailing ` # comment` first (whitespace+hash to EOL) so numeric
// values like `radius: 0.5  # rem` parse — a quoted hex "#00E676" has no
// whitespace before its # and is left intact — then remove wrapping quotes.
const strip = (v) => v.replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "").trim();

/* ------------------------------------------------------------- parameters */

const contract = readContract();
const color = contract.color || {};

const seedInput = flag("seed") || color.seed || color.brand || "#56317E";
const seed = parseColor(seedInput);
if (!seed) {
  console.error(`token-gen: cannot parse seed colour "${seedInput}"`);
  process.exit(1);
}

const accentInput = flag("accent") || color.accent || null;
const neutralHue = Number(flag("neutral-hue") || color.neutralHue || seed.H.toFixed(1));
const neutralChroma = Number(flag("neutral-chroma") || color.neutralChroma || 0.008);
const radius = Number(flag("radius") || contract.radius || 0.625);
const hueShift = Number(flag("hue-shift") || color.hueShift || 0);

// Type scale. Reading steps (xs–lg) are fixed; display steps (xl–7xl) follow the
// ratio. Previously `scaleRatio` was declared in the contract but never read.
const typeContract = contract.type || {};
const scaleRatio = Number(flag("scale-ratio") || typeContract.scaleRatio || 1.25) || 1.25;
const round3 = (n) => Math.round(n * 1000) / 1000;
const TEXT_KEYS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"];
const textScale = {
  xs: 0.75, sm: 0.875, base: 1, lg: 1.125,
  xl: round3(scaleRatio),
  "2xl": round3(scaleRatio ** 2),
  "3xl": round3(scaleRatio ** 3),
  "4xl": round3(scaleRatio ** 4),
  "5xl": round3(scaleRatio ** 5),
  "6xl": round3(scaleRatio ** 6),
  "7xl": round3(scaleRatio ** 7),
};

/* ---------------------------------------------------------------- derive */

const brand = buildRamp(seed, { hueShift });
const neutral = buildNeutralRamp(neutralHue, { chroma: neutralChroma });
const accentSeed = accentInput ? parseColor(accentInput) : null;
const accent = accentSeed ? buildRamp(accentSeed) : null;

// Where does the seed actually sit on its own ramp?
const seedStep = nearestStep(brand, seed).step;

/**
 * Pick the ramp step that works as the primary surface: the darkest step that
 * still clears AA against white for its own foreground, preferring the step
 * nearest the seed so the brand colour is preserved where possible.
 */
function pickPrimary(ramp) {
  const candidates = [seedStep, 600, 700, 500, 800];
  for (const step of candidates) {
    if (!ramp[step]) continue;
    const onWhite = contrast(ramp[step], "#FFFFFF");
    if (onWhite >= WCAG.AA_NORMAL) return step;
  }
  return 700;
}
const primaryStep = pickPrimary(brand);

/** Move n positions along the ramp, clamped to real steps. */
function stepBy(step, n) {
  const i = RAMP_STEPS.indexOf(step);
  const j = Math.min(RAMP_STEPS.length - 1, Math.max(0, (i < 0 ? 6 : i) + n));
  return RAMP_STEPS[j];
}

/**
 * Return a foreground that is GUARANTEED to clear `target` against `surface`.
 *
 * Start from white or the darkest ink, whichever is already closer, then walk
 * its lightness until the ratio is met. Deriving rather than picking is what
 * makes the output pass by construction instead of by luck.
 */
/**
 * Format an OKLCH value and GUARANTEE the emitted string still clears `target`
 * after it round-trips through CSS precision. Solving on the in-memory float
 * and formatting afterwards loses ~0.1% of ratio, which is enough to turn
 * 4.50 into 4.49 — and WCAG truncates, so 4.49 fails.
 */
const SAFETY = 1.02; // ~2% margin: the walk stops the instant truncate2 clears
                     // the target, and the ratio is computed on 8-bit sRGB, so
                     // continuous-maths implementations can land just below.

function emitPassing(fg, bgCss, target) {
  const bgIsLight = contrast(bgCss, "#000000") > contrast(bgCss, "#FFFFFF");
  const dir = bgIsLight ? -1 : 1; // darken on light grounds, lighten on dark
  let L = fg.L;
  for (let i = 0; i < 240; i++) {
    const css = formatOklch(fitChroma({ ...fg, L }));
    const r = contrast(css, bgCss);
    if (r != null && r >= target * SAFETY) return css;
    L += dir * 0.002;
    if (L < 0 || L > 1) break;
  }
  // Unreachable at this hue/chroma: fall back to the highest-contrast end.
  return contrast("#FFFFFF", bgCss) >= contrast("#000000", bgCss)
    ? "oklch(1 0 0)"
    : "oklch(0 0 0)";
}

function readableOn(surface, target = WCAG.AA_NORMAL, tint = null) {
  const white = { L: 1, C: 0, H: 0 };
  const ink = neutral[950];
  const onWhite = contrast(surface, "#FFFFFF");
  const onInk = contrast(surface, ink.css);

  if (truncate2(onWhite) >= target && onWhite >= onInk) return formatOklch(white);
  if (truncate2(onInk) >= target) return ink.css;

  // Neither end reaches the target: solve for the closer one, then verify
  // the emitted string rather than the in-memory float.
  const base = onWhite >= onInk ? white : { ...ink };
  const seedFg = tint ? { ...base, C: Math.min(tint.C * 0.25, 0.04), H: tint.H } : base;
  const solved = solveForContrast(seedFg, surface, target) || seedFg;
  return emitPassing(solved, surface, target);
}

/**
 * A muted/secondary text colour that still clears AA on BOTH the muted surface
 * and the page background. Muted text failing contrast is the most common
 * real-world accessibility defect in token systems.
 */
function mutedForeground(surfaces, hue) {
  let best = null;
  for (const s of surfaces) {
    const solved = solveForContrast({ L: 0.5, C: neutralChroma * 1.4, H: hue }, s, WCAG.AA_NORMAL);
    if (!solved) continue;
    // Keep the darkest requirement on light grounds, the lightest on dark
    if (!best) best = solved;
    else {
      const bgIsDark = contrast(s, "#FFFFFF") > 4.5;
      best = bgIsDark
        ? (solved.L > best.L ? solved : best)
        : (solved.L < best.L ? solved : best);
    }
  }
  if (!best) return neutral[600].css;
  // Walk until the emitted string clears AA on every surface it sits on.
  const bgIsDark = contrast(surfaces[0], "#FFFFFF") > 4.5;
  let L = best.L;
  for (let i = 0; i < 240; i++) {
    const css = formatOklch(fitChroma({ ...best, L }));
    if (surfaces.every((s) => contrast(css, s) >= WCAG.AA_NORMAL * SAFETY)) return css;
    L += bgIsDark ? 0.002 : -0.002;
    if (L < 0 || L > 1) break;
  }
  return bgIsDark ? neutral[300].css : neutral[700].css;
}

/* ------------------------------------------------------- semantic tokens */

function buildTheme(mode) {
  const dark = mode === "dark";
  const bg = dark ? neutral[950] : { css: "oklch(1 0 0)", L: 1, C: 0, H: 0 };
  const fg = dark ? neutral[100] : neutral[950];

  // Primary surface: lighter step in dark mode so it stays visible on a dark ground
  // In dark mode the primary surface must sit lighter than the ground, so we
  // walk three steps up the ramp rather than subtracting from the step label.
  const pStep = dark ? stepBy(primaryStep, -3) : primaryStep;
  const primary = brand[pStep];
  const pFgCss = readableOn(primary.css, WCAG.AA_NORMAL, primary);

  const t = {
    background: bg.css,
    foreground: fg.css,
    card: dark ? neutral[900].css : "oklch(1 0 0)",
    "card-foreground": fg.css,
    popover: dark ? neutral[900].css : "oklch(1 0 0)",
    "popover-foreground": fg.css,
    primary: primary.css,
    "primary-foreground": pFgCss,
    secondary: dark ? neutral[800].css : neutral[100].css,
    "secondary-foreground": readableOn(dark ? neutral[800].css : neutral[100].css),
    muted: dark ? neutral[800].css : neutral[100].css,
    "muted-foreground": mutedForeground(
      dark ? [neutral[800].css, neutral[950].css] : [neutral[100].css, "oklch(1 0 0)"],
      neutralHue
    ),
    accent: accent
      ? (dark ? accent[400].css : accent[500].css)
      : (dark ? neutral[800].css : neutral[100].css),
    "accent-foreground": accent
      ? readableOn(accent[dark ? 400 : 500].css, WCAG.AA_NORMAL, accent[dark ? 400 : 500])
      : readableOn(dark ? neutral[800].css : neutral[100].css),
    destructive: dark ? "oklch(0.704 0.191 22.216)" : "oklch(0.577 0.245 27.325)",
    border: dark ? "oklch(1 0 0 / 10%)" : neutral[200].css,
    // Input borders identify a control, so 1.4.11 applies (3:1). Plain
    // dividers are decorative and deliberately lighter.
    input: emitPassing(
      { L: dark ? 0.62 : 0.58, C: neutralChroma * 1.2, H: neutralHue },
      dark ? neutral[950].css : "oklch(1 0 0)",
      WCAG.NON_TEXT
    ),
    ring: dark ? brand[400].css : brand[primaryStep].css,
  };

  // Charts: rotate hue around the wheel from the brand, holding L and C so the
  // series read as equally weighted rather than one shouting over the others.
  const chartL = dark ? 0.68 : 0.58;
  const chartC = dark ? 0.15 : 0.16;
  [0, 62, 128, 196, 288].forEach((offset, i) => {
    const c = fitChroma({ L: chartL, C: chartC, H: (seed.H + offset) % 360 });
    t[`chart-${i + 1}`] = formatOklch(c);
  });

  t.sidebar = dark ? neutral[900].css : neutral[50].css;
  t["sidebar-foreground"] = fg.css;
  t["sidebar-primary"] = primary.css;
  t["sidebar-primary-foreground"] = pFgCss;
  t["sidebar-accent"] = dark ? neutral[800].css : neutral[100].css;
  t["sidebar-accent-foreground"] = readableOn(dark ? neutral[800].css : neutral[100].css);
  t["sidebar-border"] = dark ? "oklch(1 0 0 / 10%)" : neutral[200].css;
  t["sidebar-ring"] = dark ? brand[400].css : brand[primaryStep].css;

  return t;
}

const light = buildTheme("light");
const darkT = buildTheme("dark");

/* --------------------------------------------------------------- verify */

const PAIRS = [
  ["foreground", "background", "text"],
  ["card-foreground", "card", "text"],
  ["popover-foreground", "popover", "text"],
  ["primary-foreground", "primary", "text"],
  ["secondary-foreground", "secondary", "text"],
  ["accent-foreground", "accent", "text"],
  ["muted-foreground", "muted", "text"],
  ["muted-foreground", "background", "text"],
  ["sidebar-foreground", "sidebar", "text"],
  ["sidebar-primary-foreground", "sidebar-primary", "text"],
  ["sidebar-accent-foreground", "sidebar-accent", "text"],
  ["ring", "background", "nontext"],
  ["input", "background", "nontext"],
];

// Decorative boundaries. 1.4.11 governs component boundaries you must be able
// to identify; a plain divider is not one. Reported, never gated.
const ADVISORY_PAIRS = [
  ["border", "background"],
  ["sidebar-border", "sidebar"],
];

function verify(theme, label) {
  const rows = [];
  for (const [fg, bg, kind] of PAIRS) {
    // alpha-composited tokens can't be measured directly; skip and flag
    if (/\/\s*\d+%/.test(theme[fg]) || /\/\s*\d+%/.test(theme[bg])) {
      rows.push({ theme: label, fg, bg, kind, ratio: null, grade: "n/a (alpha)" });
      continue;
    }
    const r = contrast(theme[fg], theme[bg]);
    rows.push({
      theme: label, fg, bg, kind,
      ratio: truncate2(r),
      grade: grade(r, kind),
      pass: kind === "nontext" ? r >= WCAG.NON_TEXT : r >= WCAG.AA_NORMAL,
    });
  }
  return rows;
}

const report = [...verify(light, "light"), ...verify(darkT, "dark")];
const failures = report.filter((r) => r.pass === false);

/* ---------------------------------------------------------------- emit */

const css = `/* ------------------------------------------------------------------
 * Design tokens — generated by token-gen from DESIGN-CONTRACT.md
 *
 * DO NOT hand-edit colour values here. Change DESIGN-CONTRACT.md and
 * re-run:  node tools/token-gen.mjs --out app/globals.css
 *
 * Seed        ${oklchToHex(seed)}  ${formatOklch(seed)}
 * Primary     step ${primaryStep} of the brand ramp
 * Neutral hue ${neutralHue}deg (biased toward the brand, never pure grey)
 * ------------------------------------------------------------------ */

@import "tailwindcss";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
${[1, 2, 3, 4, 5].map((i) => `  --color-chart-${i}: var(--chart-${i});`).join("\n")}
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* Fonts — bridge Tailwind's font-* utilities to the faces next/font loads.
   * The foundation layout sets --font-*-face via next/font; without this map
   * the font-display utility is dead and headings fall back to the body font.
   * Fallbacks keep font-* valid if a project does not use those face vars. */
  --font-sans: var(--font-body-face, ui-sans-serif, system-ui, sans-serif);
  --font-display: var(--font-display-face, var(--font-body-face, ui-sans-serif, system-ui, sans-serif));
  --font-mono: var(--font-mono-face, ui-monospace, monospace);

  /* Brand ramp — available as bg-brand-600, text-brand-400 etc. */
${RAMP_STEPS.map((s) => `  --color-brand-${s}: ${brand[s].css};`).join("\n")}

  /* Neutral ramp — hue-biased toward the brand, never pure grey */
${RAMP_STEPS.map((s) => `  --color-ink-${s}: ${neutral[s].css};`).join("\n")}
${accent ? `\n  /* Accent ramp */\n${RAMP_STEPS.map((s) => `  --color-accent-${s}: ${accent[s].css};`).join("\n")}\n` : ""}
  /* Radius — shadcn derives sm..4xl from this single value */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);

  /* Type scale — ${scaleRatio} ratio from a 16px base. Reading steps (xs–lg)
   * stay fixed; display steps (xl–7xl) follow the ratio. Nothing between steps. */
${TEXT_KEYS.map((k) => `  --text-${k}: ${textScale[k]}rem;`).join("\n")}

  /* Motion — one duration set, one easing set, used everywhere */
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out-quint: cubic-bezier(0.83, 0, 0.17, 1);
  --duration-instant: 100ms;
  --duration-fast: 160ms;
  --duration-base: 240ms;
  --duration-slow: 400ms;
}

:root {
  --radius: ${radius}rem;
${Object.entries(light).map(([k, v]) => `  --${k}: ${v};`).join("\n")}

  /* Stacking scale — every z-index in the project comes from here */
  --z-base: 0;
  --z-raised: 10;
  --z-sticky: 20;
  --z-overlay: 30;
  --z-modal: 40;
  --z-toast: 50;
  --z-tooltip: 60;
}

.dark {
${Object.entries(darkT).map(([k, v]) => `  --${k}: ${v};`).join("\n")}
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
    /* 1.5 is the WCAG 1.4.8 floor for body text, not a stylistic choice */
    line-height: 1.5;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  /* Focus is never removed, only restyled. WCAG 2.4.7 + 1.4.11 (3:1). */
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  /* Headings tighten as they grow; body copy never goes below 1.5 */
  h1, h2, h3, h4 {
    text-wrap: balance;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  p, li {
    text-wrap: pretty;
  }

  /* Sticky headers must not obscure the focused element. WCAG 2.4.11 */
  html {
    scroll-padding-top: var(--header-height, 5rem);
  }
}

/* ------------------------------------------------------------------
 * Reduced motion. Required — WCAG 2.3.3 and 2.2.2.
 * Note the near-zero duration rather than 'none': some libraries wait on
 * animationend/transitionend, and 'none' strands them forever.
 * ------------------------------------------------------------------ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.01ms !important;
    animation-delay: 0s !important;
  }
}

/* View transitions must never swallow clicks mid-animation */
::view-transition {
  pointer-events: none;
}
`;

/* ------------------------------------------------ React Native theme (hex) */
// RN's colour engine cannot parse oklch(); emit hex (8-digit hex for alpha).
function toRnHex(cssValue) {
  if (typeof cssValue !== "string") return "#000000";
  const alphaM = cssValue.match(/\/\s*([\d.]+)\s*%/);
  const base = cssValue.replace(/\s*\/\s*[\d.]+\s*%\s*/, " ").trim();
  let hex = "#000000";
  try { const c = parseColor(base); if (c) hex = oklchToHex(c); } catch { /* keep fallback */ }
  if (alphaM) {
    const a = Math.round(Math.max(0, Math.min(100, parseFloat(alphaM[1]))) / 100 * 255);
    hex = hex + a.toString(16).padStart(2, "0");
  }
  return hex;
}

function tsObj(obj, indent) {
  return Object.entries(obj)
    .map(([k, v]) => `${indent}"${k}": ${typeof v === "number" ? v : `"${v}"`},`)
    .join("\n");
}

// A typed theme.ts for React Native / NativeWind: same generated values as the
// CSS, but hex colours and dp numbers (rem * 16) instead of CSS units.
function buildThemeTs() {
  const lightHex = Object.fromEntries(Object.entries(light).map(([k, v]) => [k, toRnHex(v)]));
  const darkHex = Object.fromEntries(Object.entries(darkT).map(([k, v]) => [k, toRnHex(v)]));
  const brandHex = Object.fromEntries(RAMP_STEPS.map((s) => [s, brand[s].hex]));
  const inkHex = Object.fromEntries(RAMP_STEPS.map((s) => [s, neutral[s].hex]));
  const accentHex = accent ? Object.fromEntries(RAMP_STEPS.map((s) => [s, accent[s].hex])) : null;
  const dp = (rem) => Math.round(rem * 16);
  const radii = {
    sm: dp(radius * 0.6), md: dp(radius * 0.8), lg: dp(radius),
    xl: dp(radius * 1.4), "2xl": dp(radius * 1.8), "3xl": dp(radius * 2.2), "4xl": dp(radius * 2.6),
  };
  const fontSizes = Object.fromEntries(TEXT_KEYS.map((k) => [k, dp(textScale[k])]));
  const fam = {
    display: typeContract.display || "System",
    body: typeContract.body || "System",
    mono: typeContract.mono || "monospace",
  };
  return `/* Auto-generated by token-gen from DESIGN-CONTRACT.md — do not hand-edit colours.
 * React Native / NativeWind theme. Colours are HEX because RN cannot parse oklch().
 * Seed ${oklchToHex(seed)} · primary step ${primaryStep} · neutral hue ${neutralHue}.
 * Regenerate:  node tools/token-gen.mjs --theme theme.ts
 */

export const colors = {
  light: {
${tsObj(lightHex, "    ")}
  },
  dark: {
${tsObj(darkHex, "    ")}
  },
} as const;

export const brand = {
${tsObj(brandHex, "  ")}
} as const;

export const ink = {
${tsObj(inkHex, "  ")}
} as const;
${accentHex ? `\nexport const accent = {\n${tsObj(accentHex, "  ")}\n} as const;\n` : ""}
export const radius = {
${tsObj(radii, "  ")}
} as const;

export const fontSize = {
${tsObj(fontSizes, "  ")}
} as const;

export const fontFamily = {
${tsObj(fam, "  ")}
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof typeof colors.light;

export const theme = { colors, brand, ink,${accentHex ? " accent," : ""} radius, fontSize, fontFamily } as const;
export default theme;
`;
}

/* ---------------------------------------------------------------- output */

if (has("json")) {
  console.log(
    JSON.stringify(
      {
        seed: { hex: oklchToHex(seed), css: formatOklch(seed), step: seedStep },
        primaryStep,
        brand: Object.fromEntries(RAMP_STEPS.map((s) => [s, brand[s].hex])),
        neutral: Object.fromEntries(RAMP_STEPS.map((s) => [s, neutral[s].hex])),
        accent: accent ? Object.fromEntries(RAMP_STEPS.map((s) => [s, accent[s].hex])) : null,
        light, dark: darkT, contrast: report, failures,
      },
      null,
      2
    )
  );
  process.exit(failures.length ? 1 : 0);
}

const outPath = flag("out");
if (outPath) {
  const abs = path.resolve(ROOT, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, css);
  console.log(`\x1b[32m✓\x1b[0m wrote ${path.relative(ROOT, abs)}`);
} else if (!flag("theme")) {
  process.stdout.write(css);
}

// React Native theme output. `--theme theme.ts` writes the hex/dp theme module.
const themePath = flag("theme");
if (themePath) {
  const abs = path.resolve(ROOT, themePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buildThemeTs());
  console.log(`\x1b[32m✓\x1b[0m wrote ${path.relative(ROOT, abs)}`);
}

/* --------------------------------------------------------- verification */

if (outPath || themePath || has("verify")) {
  console.log("\n\x1b[1mContrast verification\x1b[0m  (WCAG 2.2, truncated not rounded)\n");
  let lastTheme = null;
  for (const r of report) {
    if (r.theme !== lastTheme) {
      console.log(`  \x1b[2m── ${r.theme} ──\x1b[0m`);
      lastTheme = r.theme;
    }
    const mark =
      r.ratio == null ? "\x1b[2m–\x1b[0m" : r.pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    const req = r.kind === "nontext" ? "3.0" : "4.5";
    console.log(
      `  ${mark} ${String(r.ratio ?? "n/a").padStart(6)}  (min ${req})  ${r.fg} on ${r.bg}  \x1b[2m${r.grade}\x1b[0m`
    );
  }
  if (failures.length) {
    console.log(`\n\x1b[31m${failures.length} contrast failure(s).\x1b[0m Suggested fixes:\n`);
    for (const f of failures) {
      const theme = f.theme === "light" ? light : darkT;
      const fixed = solveForContrast(parseColor(theme[f.fg]), theme[f.bg], WCAG.AA_NORMAL);
      console.log(
        `  ${f.theme}/${f.fg}: ${theme[f.fg]}  →  ${fixed ? formatOklch(fixed) : "unreachable in sRGB — change the hue or the surface"}`
      );
    }
    process.exit(1);
  }
  console.log(`\n\x1b[32m✓ all ${report.filter((r) => r.pass !== null).length} gated token pairs pass\x1b[0m`);
  const adv = ADVISORY_PAIRS.flatMap(([fg, bg]) =>
    [["light", light], ["dark", darkT]].map(([name, t]) =>
      t[fg] && t[bg] && !/\/\s*\d+%/.test(t[fg]) && !/\/\s*\d+%/.test(t[bg])
        ? `${name}/${fg} on ${bg}: ${truncate2(contrast(t[fg], t[bg]))}:1`
        : null
    )
  ).filter(Boolean);
  if (adv.length) {
    console.log(
      "\x1b[2madvisory (decorative dividers, not gated — 1.4.11 covers component\n" +
        "boundaries you must identify, not plain rules):\n  " +
        adv.join("\n  ") +
        "\x1b[0m\n"
    );
  }
}
