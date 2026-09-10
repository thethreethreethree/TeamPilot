/**
 * WCAG 2.2 contrast maths.
 *
 * WCAG 2.x is the only contrast model with legal standing. APCA is NOT in the
 * WCAG 3 draft — it was pulled in July 2023 and the March 2026 WCAG 3 draft
 * does not mention it. We compute APCA as an ADVISORY signal only (it models
 * dark-mode and thin-type legibility better than WCAG 2), and never gate on it.
 *
 * Sources:
 *   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 *   https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
 *   https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html
 */

import { oklchToRgb, parseColor, srgbToLinear } from "./oklch.mjs";

/* --------------------------------------------------------- WCAG 2.x core */

/** Relative luminance per WCAG 2.x. Input rgb 0..255. */
export function relativeLuminance({ r, g, b }) {
  return (
    0.2126 * srgbToLinear(r / 255) +
    0.7152 * srgbToLinear(g / 255) +
    0.0722 * srgbToLinear(b / 255)
  );
}

/**
 * Contrast ratio, 1..21.
 *
 * NOTE: W3C states computed values must NOT be rounded up. 4.499:1 fails 4.5:1.
 * We therefore truncate to 2dp when reporting, and compare on the raw value.
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Truncate (never round up) to 2 decimal places, per W3C guidance. */
export const truncate2 = (n) => Math.floor(n * 100) / 100;

/**
 * WCAG 2.2 thresholds.
 *
 * "Large text" is >= 18pt, or >= 14pt bold. W3C's Understanding doc converts
 * these at 1pt = 1.333px and states the equivalents as "approximately 18.5px
 * and 24px". 14 x 1.333 = 18.66, so sources differ by a sixth of a pixel; we
 * take the stricter 18.66 because rounding down would grade sub-threshold
 * text as large. Either way, 18px bold does NOT qualify — a common tool bug.
 */
export const WCAG = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
  NON_TEXT: 3.0, // 1.4.11 — UI components, graphical objects, focus indicators
  LARGE_PX: 24,
  LARGE_BOLD_PX: 18.66,
};

/** Is this text "large scale" per 1.4.3? */
export function isLargeText(px, weight = 400) {
  return weight >= 700 ? px >= WCAG.LARGE_BOLD_PX : px >= WCAG.LARGE_PX;
}

/** Grade a ratio. `kind` is 'text' | 'large' | 'nontext'. */
export function grade(ratio, kind = "text") {
  if (kind === "nontext") return ratio >= WCAG.NON_TEXT ? "pass" : "fail";
  if (kind === "large") {
    if (ratio >= WCAG.AAA_LARGE) return "AAA";
    if (ratio >= WCAG.AA_LARGE) return "AA";
    return "fail";
  }
  if (ratio >= WCAG.AAA_NORMAL) return "AAA";
  if (ratio >= WCAG.AA_NORMAL) return "AA";
  if (ratio >= WCAG.AA_LARGE) return "AA Large only";
  return "fail";
}

/** Accepts hex / rgb() / oklch() strings or {L,C,H} / {r,g,b} objects. */
export function toRgb(input) {
  if (input && typeof input === "object") {
    if ("r" in input) return input;
    if ("L" in input) return oklchToRgb(input);
  }
  const parsed = parseColor(input);
  if (!parsed) return null;
  return oklchToRgb(parsed);
}

/** Convenience: contrast between two colour values in any notation. */
export function contrast(a, b) {
  const ra = toRgb(a);
  const rb = toRgb(b);
  if (!ra || !rb) return null;
  return contrastRatio(ra, rb);
}

/* ------------------------------------------------------------- APCA (advisory) */

/**
 * APCA 0.1.9 (W3 formula 0.0.98G-4g), simplified reference implementation.
 * ADVISORY ONLY — never gate on this. Returns Lc, signed:
 *   positive => dark text on light background
 *   negative => light text on dark background
 */
const APCA = {
  mainTRC: 2.4,
  Sco: 0.2126729, Smc: 0.7151522, Sbo: 0.072175,
  normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
  blkThrs: 0.022, blkClmp: 1.414,
  scaleBoW: 1.14, scaleWoB: 1.14,
  loBoWoffset: 0.027, loWoBoffset: 0.027,
  deltaYmin: 0.0005,
};

function apcaY({ r, g, b }) {
  const f = (c) => Math.pow(c / 255, APCA.mainTRC);
  return APCA.Sco * f(r) + APCA.Smc * f(g) + APCA.Sbo * f(b);
}

export function apcaLc(textColor, bgColor) {
  const txt = toRgb(textColor);
  const bg = toRgb(bgColor);
  if (!txt || !bg) return null;

  let Ytxt = apcaY(txt);
  let Ybg = apcaY(bg);

  Ytxt = Ytxt > APCA.blkThrs ? Ytxt : Ytxt + Math.pow(APCA.blkThrs - Ytxt, APCA.blkClmp);
  Ybg = Ybg > APCA.blkThrs ? Ybg : Ybg + Math.pow(APCA.blkThrs - Ybg, APCA.blkClmp);

  if (Math.abs(Ybg - Ytxt) < APCA.deltaYmin) return 0;

  let out;
  if (Ybg > Ytxt) {
    // dark text on light bg
    const S = Math.pow(Ybg, APCA.normBG) - Math.pow(Ytxt, APCA.normTXT);
    out = S * APCA.scaleBoW;
    out = out < APCA.loBoWoffset ? 0 : out - APCA.loBoWoffset;
  } else {
    const S = Math.pow(Ybg, APCA.revBG) - Math.pow(Ytxt, APCA.revTXT);
    out = S * APCA.scaleWoB;
    out = out > -APCA.loWoBoffset ? 0 : out + APCA.loWoBoffset;
  }
  return out * 100;
}

/**
 * APCA use-case guidance (NOT compliance thresholds).
 * Lc 75 = body text minimum (deliberately stricter than WCAG AA)
 * Lc 60 = non-body content text  |  Lc 45 = large/headline  |  Lc 30 = spot readable
 */
export function apcaAdvice(lc) {
  const a = Math.abs(lc);
  if (a >= 90) return "body-preferred";
  if (a >= 75) return "body-min";
  if (a >= 60) return "content-min";
  if (a >= 45) return "large-min";
  if (a >= 30) return "spot-only";
  return "insufficient";
}

/* ---------------------------------------------------- Suggestion helper */

/**
 * Given a foreground and background, find the nearest lightness for the
 * FOREGROUND that reaches a target ratio, preserving hue and chroma.
 * Returns null if unreachable inside sRGB.
 */
export function solveForContrast(fgOklch, bgColor, target) {
  const bg = toRgb(bgColor);
  if (!bg) return null;
  const bgLum = relativeLuminance(bg);
  const goDarker = bgLum > 0.18; // heuristic: light bg -> darken the text

  let lo = goDarker ? 0 : fgOklch.L;
  let hi = goDarker ? fgOklch.L : 1;
  let best = null;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const cand = { ...fgOklch, L: mid };
    const ratio = contrastRatio(oklchToRgb(cand), bg);
    if (ratio >= target) {
      best = cand;
      if (goDarker) lo = mid;
      else hi = mid;
    } else if (goDarker) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}
