/**
 * Schedule export colour system (§1.5.4 — the founder specified a colour-coded, easy-to-read graphic; the
 * colour band IS the intended result, not optional polish). A shift is classified into a time-of-day BAND from
 * its start time, and each band has a fixed, high-contrast palette so a manager scanning the printed/downloaded
 * schedule sees blocks of colour and reads "who works mornings vs nights" at a glance — no legend-hunting.
 *
 * Pure + unit-tested so the classification (the real logic) is verifiable without a canvas. The canvas renderer
 * is thin wiring over `bandFromLabel` + `BAND_STYLE`.
 */

export type ShiftBand = "morning" | "day" | "evening" | "overnight" | "off";

export interface BandStyle {
  /** Human label for the legend. */
  label: string;
  /** Cell fill (soft tint). */
  bg: string;
  /** Cell text (same hue, dark enough for contrast on `bg`). */
  fg: string;
  /** Legend/accent dot (saturated). */
  dot: string;
}

/** The five bands. Hues chosen to be distinct at a glance AND to read as their time of day: sunrise amber →
 *  daytime sky → evening violet → night indigo, with time-off in a warning rose. */
export const BAND_STYLE: Record<ShiftBand, BandStyle> = {
  morning: { label: "Morning", bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B" },
  day: { label: "Daytime", bg: "#E0F2FE", fg: "#075985", dot: "#0EA5E9" },
  evening: { label: "Evening", bg: "#EDE9FE", fg: "#5B21B6", dot: "#8B5CF6" },
  overnight: { label: "Overnight", bg: "#E0E7FF", fg: "#3730A3", dot: "#6366F1" },
  off: { label: "Time off", bg: "#FFE4E6", fg: "#9F1239", dot: "#F43F5E" },
};

/** The worked bands, in time-of-day order, for the legend (off is shown separately, only when present). */
export const WORKED_BANDS: ShiftBand[] = ["morning", "day", "evening", "overnight"];

/**
 * Classify a shift by its START hour, treating a shift whose end is at/before its start (crosses midnight) as
 * overnight regardless of the start hour. Opening shifts read amber, midday sky, closing violet, graveyard
 * indigo.
 */
export function bandOf(startHour: number, crossesMidnight: boolean): Exclude<ShiftBand, "off"> {
  if (crossesMidnight || startHour >= 20 || startHour < 5) return "overnight";
  if (startHour < 11) return "morning";
  if (startHour < 15) return "day";
  return "evening";
}

/**
 * Band for a "HH:mm-HH:mm" cell label (the shape the grid produces). Returns null for a label that doesn't
 * parse, so the caller can fall back to a neutral cell rather than mis-colour it.
 */
export function bandFromLabel(label: string): Exclude<ShiftBand, "off"> | null {
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(label);
  if (!m) return null;
  const sMin = Number(m[1]) * 60 + Number(m[2]);
  const eMin = Number(m[3]) * 60 + Number(m[4]);
  return bandOf(Number(m[1]), eMin <= sMin);
}
