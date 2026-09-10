/**
 * OKLCH / sRGB colour engine.
 *
 * Why OKLCH: the L axis maps to *perceived* lightness, so a ramp built by
 * stepping L gives visually even steps and predictable contrast behaviour
 * across hues. HSL does not — equal HSL lightness across hues differs wildly
 * in perceived brightness, which is what produces muddy mid-tones and
 * unpredictable WCAG results.
 *
 * Reference: Björn Ottosson, "A perceptual color space for image processing"
 * (Oklab, 2020). CSS Color 4 `oklch()` is Baseline Widely Available.
 *
 * No dependencies. Pure functions. All maths verified against the CSS Color 4
 * sample implementation.
 */

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ sRGB */

/** sRGB gamma-encoded channel (0..1) -> linear-light */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** linear-light channel -> sRGB gamma-encoded (0..1) */
export function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/* ----------------------------------------------------------------- Oklab */

/** linear sRGB {r,g,b} (0..1) -> Oklab {L,a,b} */
export function linearSrgbToOklab({ r, g, b }) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** Oklab {L,a,b} -> linear sRGB {r,g,b} (may be out of 0..1 gamut) */
export function oklabToLinearSrgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

/* ----------------------------------------------------------------- OKLCH */

/** OKLCH {L, C, H(deg)} -> Oklab */
export function oklchToOklab({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(h), b: C * Math.sin(h) };
}

/** Oklab -> OKLCH {L, C, H(deg 0..360)} */
export function oklabToOklch({ L, a, b }) {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: C, H: C < 1e-7 ? 0 : H };
}

/* --------------------------------------------------------------- Bridges */

/** OKLCH -> sRGB {r,g,b} in 0..255, with an `inGamut` flag. */
export function oklchToRgb({ L, C, H }) {
  const lin = oklabToLinearSrgb(oklchToOklab({ L, C, H }));
  const inGamut =
    lin.r >= -1e-4 && lin.r <= 1 + 1e-4 &&
    lin.g >= -1e-4 && lin.g <= 1 + 1e-4 &&
    lin.b >= -1e-4 && lin.b <= 1 + 1e-4;
  return {
    r: Math.round(clamp(linearToSrgb(clamp(lin.r))) * 255),
    g: Math.round(clamp(linearToSrgb(clamp(lin.g))) * 255),
    b: Math.round(clamp(linearToSrgb(clamp(lin.b))) * 255),
    inGamut,
  };
}

/** sRGB 0..255 -> OKLCH */
export function rgbToOklch({ r, g, b }) {
  return oklabToOklch(
    linearSrgbToOklab({
      r: srgbToLinear(r / 255),
      g: srgbToLinear(g / 255),
      b: srgbToLinear(b / 255),
    })
  );
}

/* ------------------------------------------------------------------ Hex */

export function hexToRgb(hex) {
  const h = String(hex).trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const h = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export const hexToOklch = (hex) => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToOklch(rgb) : null;
};

export const oklchToHex = (c) => rgbToHex(oklchToRgb(c));

/* ------------------------------------------------------------- Gamut fit */

/**
 * Reduce chroma until the colour fits inside sRGB, preserving L and H.
 * Binary search — 24 iterations lands well inside 1/255 of a channel.
 */
export function fitChroma({ L, C, H }) {
  if (oklchToRgb({ L, C, H }).inGamut) return { L, C, H };
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (oklchToRgb({ L, C: mid, H }).inGamut) lo = mid;
    else hi = mid;
  }
  return { L, C: lo, H };
}

/* ------------------------------------------------------------ Formatting */

/** Canonical CSS string. Precision chosen to round-trip through 8-bit sRGB. */
export function formatOklch({ L, C, H }, { alpha } = {}) {
  const l = (L * 100).toFixed(2).replace(/\.?0+$/, "");
  const c = C.toFixed(4).replace(/\.?0+$/, "");
  const h = H.toFixed(2).replace(/\.?0+$/, "");
  const base = `oklch(${l}% ${c || 0} ${h || 0}`;
  return alpha == null || alpha >= 1 ? `${base})` : `${base} / ${alpha})`;
}

/** Parse `oklch(62.3% 0.18 268)` / `oklch(0.623 0.18 268 / 50%)`. */
export function parseOklch(str) {
  const m = String(str)
    .trim()
    .match(
      /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/i
    );
  if (!m) return null;
  const L = m[2] === "%" ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const alpha = m[5] == null ? 1 : m[6] === "%" ? parseFloat(m[5]) / 100 : parseFloat(m[5]);
  return { L, C: parseFloat(m[3]), H: parseFloat(m[4]), alpha };
}

/** Parse any supported colour notation to {L,C,H,alpha}. Returns null if unknown. */
export function parseColor(str) {
  const s = String(str).trim();
  const ok = parseOklch(s);
  if (ok) return ok;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) {
    const c = hexToOklch(s.slice(0, 7));
    return c ? { ...c, alpha: 1 } : null;
  }
  const rgbm = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgbm) {
    return {
      ...rgbToOklch({
        r: parseFloat(rgbm[1]),
        g: parseFloat(rgbm[2]),
        b: parseFloat(rgbm[3]),
      }),
      alpha: 1,
    };
  }
  return null;
}

/* ---------------------------------------------------------------- Ramps */

/**
 * Lightness targets for an 11-step ramp (50 -> 950).
 *
 * These are chosen so that step 600 lands near L 0.45–0.55 (a workable
 * primary on white) and the ends stay clear of pure white/black. The curve is
 * intentionally non-linear: perceptual spacing at the light end needs smaller
 * L deltas than at the dark end.
 */
export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export const RAMP_LIGHTNESS = {
  50: 0.971, 100: 0.936, 200: 0.885, 300: 0.808, 400: 0.704,
  500: 0.606, 600: 0.523, 700: 0.451, 800: 0.383, 900: 0.321, 950: 0.234,
};

/**
 * Chroma envelope. Chroma must taper toward both ends or the light and dark
 * steps fall out of the sRGB gamut and get clipped — which is what makes
 * naively generated ramps look chalky at the top and muddy at the bottom.
 * Values are multipliers on the ramp's peak chroma.
 */
export const RAMP_CHROMA_SCALE = {
  50: 0.13, 100: 0.26, 200: 0.48, 300: 0.72, 400: 0.92, 500: 1.0,
  600: 1.0, 700: 0.9, 800: 0.76, 900: 0.62, 950: 0.44,
};

/**
 * Build a perceptually even 11-step ramp from a single seed colour.
 *
 * @param {{L:number,C:number,H:number}} seed  usually the brand colour
 * @param {object}  opts
 * @param {number}  opts.peakChroma  overrides the seed's chroma as the ramp peak
 * @param {number}  opts.hueShift    degrees of hue rotation from step 50 to 950.
 *                                   A small negative shift (-4..-8) keeps dark
 *                                   steps from going purple-cold; positive warms
 *                                   them. 0 = strictly monochromatic hue.
 * @returns {Record<number,{L,C,H,hex,css}>}
 */
export function buildRamp(seed, { peakChroma, hueShift = 0 } = {}) {
  const peak = peakChroma ?? seed.C;
  const out = {};
  const n = RAMP_STEPS.length - 1;
  RAMP_STEPS.forEach((step, i) => {
    const L = RAMP_LIGHTNESS[step];
    const H = (seed.H + hueShift * (i / n) + 360) % 360;
    const C = peak * RAMP_CHROMA_SCALE[step];
    const fitted = fitChroma({ L, C, H });
    out[step] = {
      ...fitted,
      hex: oklchToHex(fitted),
      css: formatOklch(fitted),
      clipped: fitted.C < C - 1e-4,
    };
  });
  return out;
}

/**
 * Find the ramp step whose colour is closest to a target seed.
 * Used to report "your brand colour is effectively the 600 step".
 */
export function nearestStep(ramp, seed) {
  let best = null;
  for (const step of RAMP_STEPS) {
    const c = ramp[step];
    // Perceptual distance in Oklab
    const a1 = oklchToOklab(c);
    const a2 = oklchToOklab(seed);
    const d = Math.hypot(a1.L - a2.L, a1.a - a2.a, a1.b - a2.b);
    if (!best || d < best.d) best = { step, d };
  }
  return best;
}

/**
 * Build a neutral ramp carrying a slight hue bias toward the brand.
 * A pure #808080 grey next to a saturated brand colour reads as unconsidered;
 * a few points of chroma on the brand hue makes the greys feel chosen.
 */
export function buildNeutralRamp(hue, { chroma = 0.008 } = {}) {
  const out = {};
  RAMP_STEPS.forEach((step) => {
    const L = RAMP_LIGHTNESS[step];
    // slightly more chroma in the mids, near-zero at the extremes
    const c = chroma * (RAMP_CHROMA_SCALE[step] * 0.6 + 0.4);
    const fitted = fitChroma({ L, C: c, H: hue });
    out[step] = { ...fitted, hex: oklchToHex(fitted), css: formatOklch(fitted) };
  });
  return out;
}
