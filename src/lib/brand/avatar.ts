/**
 * Avatar rendering helpers — shared by chat, tasks, notifications.
 *
 * Two layers:
 *   1. User-customizable values from profiles.avatar_color +
 *      profiles.avatar_initials (migration 0024). Users set these in
 *      Settings → Avatar.
 *   2. Deterministic fallback values when the user hasn't set custom
 *      ones, so an avatar still renders something stable and distinct
 *      without any setup step.
 *
 * The renderer (MessageRow, etc.) calls:
 *   bg       = msg.authorAvatarColor    ?? avatarColorFor(id, name)
 *   initials = msg.authorAvatarInitials ?? avatarInitialsFor(name)
 *   fg       = avatarTextColorFor(bg)   // contrast guard
 */

/**
 * Default palette — the brand ember (amber) family plus a handful of
 * non-clashing warm/neutral hues that read on the matte-black field.
 * Curated so two adjacent picks don't look too similar.
 *
 * No red. Same governance as docs/BRAND.md — the visual identity is
 * mono-warm and any accent has to coexist with the bulb.
 */
export const AVATAR_PALETTE = [
  "#FACC15", // ember-400 (the bulb)
  "#FDE047", // ember-300
  "#EAB308", // ember-500
  "#CA8A04", // ember-600
  "#854D0E", // ember-800 burnt amber
  "#F5A524", // saffron
  "#FCD34D", // warm sand
  "#A16207", // ember-700
  "#FDB833", // marigold
  "#BFA374", // muted gold
  "#D4D4D8", // ink-300 neutral
  "#71717A", // ink-500 neutral
] as const;

/** Hash a stable key into a palette index. */
function stableHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deterministic default avatar color, derived from author id (preferred)
 * or name (fallback). Same input → same color across mounts so an
 * unconfigured user's avatar stays stable rather than flickering.
 */
export function avatarColorFor(
  authorId: string | null,
  authorName: string
): string {
  const key = authorId || authorName || "anon";
  const idx = stableHash(key) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx]!;
}

/**
 * Derive initials from a display name when the user hasn't customized:
 *   "Sarah Kim (CFO)"  → "SK"
 *   "John"             → "J"
 *   "Moses Maniquiz"   → "MM"
 *   undefined / empty  → "?"
 */
export function avatarInitialsFor(authorName: string | null | undefined): string {
  if (!authorName) return "?";
  const cleaned = authorName.replace(/\([^)]*\)/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Contrast guard: dark text on light/saturated chips, white text on
 * dark chips. Uses YIQ-style luminance with the standard 128 cutoff
 * for "is this background bright enough that black text reads on it?"
 */
export function avatarTextColorFor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#09090B";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // YIQ approximation — heavier weighting on green because the eye
  // is most sensitive to it. The 128 threshold is empirical but very
  // standard across design systems.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#09090B" : "#FAFAFA";
}

/** Validate a candidate hex color string. Used by the settings form. */
export function isValidAvatarColor(input: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(input.trim());
}

/** Validate a candidate initials string. 1–3 chars, alphanumeric. */
export function isValidAvatarInitials(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.length >= 1 && trimmed.length <= 3;
}
