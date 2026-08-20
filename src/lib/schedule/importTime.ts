import type { ShiftTimes } from "./gridParser";

/**
 * Schedule import — time normalization. The preview/commit require strict "HH:mm" 24-hour; free-text time
 * inputs (and the LLM's proposal) could be "1", "1pm", "1:00 PM", "13", "13:00" — and any non-HH:mm value
 * failed validation, silently breaking the whole import (4 real failures, 2026-08-20). These pure helpers
 * coerce ANY human time to HH:mm (or "" if unparseable) so no format can break the import. A bare number is
 * read literally (1 -> 01:00); use 1pm / 13 for the afternoon.
 */

export function to24h(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  let m = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/.exec(s);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const ap = m[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return "";
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  m = /^(\d{1,2})\s*(am|pm)?$/.exec(s);
  if (m) {
    let h = Number(m[1]);
    const ap = m[2];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h > 23) return "";
    return `${String(h).padStart(2, "0")}:00`;
  }
  return "";
}

/** Coerce every code's times to strict HH:mm; a code whose time can't be parsed is DROPPED (stays visibly
 *  "needs mapping"), never sent as an invalid value. Applied to the LLM proposal + before preview/commit. */
export function normalizeCodeMap(map: Record<string, ShiftTimes | "off">): Record<string, ShiftTimes | "off"> {
  const out: Record<string, ShiftTimes | "off"> = {};
  for (const [code, v] of Object.entries(map)) {
    if (v === "off") { out[code] = "off"; continue; }
    const start = to24h(v.start);
    const end = to24h(v.end);
    if (start && end) out[code] = { start, end };
  }
  return out;
}

/** OFF tokens recognized deterministically on import (case-insensitive). Mirrors the import page's OFF set. */
const OFF_TOKENS = new Set(["OFF", "REST", "RD", "DO", "RDO", "OFF DAY", "REST DAY", "DAY OFF"]);

/** A cell that is ALREADY an explicit HH:mm time range ("06:00-15:00", "9:00am-5:00pm") — both sides carry a
 *  colon, so it is UNAMBIGUOUS (unlike an org code like "6-3", which stays for the LLM/human to map). */
const EXPLICIT_RANGE = /^\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*$/i;

/**
 * Build a code map DETERMINISTICALLY for codes that are self-describing — an explicit "HH:mm-HH:mm" range or an
 * OFF token — so a file carrying explicit times (including one WE exported) round-trips with NO manual mapping
 * and NO LLM guess (§3.4 — deterministic where the data is unambiguous). Ambiguous org codes are left out
 * (return has no entry for them), so they still surface as "needs mapping".
 */
export function autoTimeRangeCodeMap(codes: string[]): Record<string, ShiftTimes | "off"> {
  const out: Record<string, ShiftTimes | "off"> = {};
  for (const code of codes) {
    const c = code.trim();
    if (!c) continue;
    if (OFF_TOKENS.has(c.toUpperCase())) { out[code] = "off"; continue; }
    const m = EXPLICIT_RANGE.exec(c);
    if (!m) continue;
    const start = to24h(m[1] ?? "");
    const end = to24h(m[2] ?? "");
    if (start && end) out[code] = { start, end };
  }
  return out;
}
