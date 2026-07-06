import type { OutsideViewReading } from "./types";

/**
 * Parse + VALIDATE the §1.3 outside-view model output. Previously the caller
 * returned `parsed.readings` unvalidated, so a malformed LLM item (a reading
 * missing one of its three parts) would flow to the UI with blank fields. This
 * enforces the shape: a reading is kept only if it has all three non-empty
 * parts — framing, whatItChallenges, ifTrueThen — else it is dropped (§3.4: do
 * not surface a half-formed alternative). Caps at `count`; malformed / non-array
 * output degrades to []. Pure + dependency-free so it is testable in isolation
 * (outsideView.ts is server-only).
 */
export function parseOutsideViews(
  text: string,
  count: number
): OutsideViewReading[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const readings = (parsed as { readings?: unknown }).readings;
  if (!Array.isArray(readings)) return [];

  const out: OutsideViewReading[] = [];
  for (const r of readings) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const framing = typeof o.framing === "string" ? o.framing.trim() : "";
    const whatItChallenges =
      typeof o.whatItChallenges === "string" ? o.whatItChallenges.trim() : "";
    const ifTrueThen =
      typeof o.ifTrueThen === "string" ? o.ifTrueThen.trim() : "";
    if (framing && whatItChallenges && ifTrueThen) {
      out.push({ framing, whatItChallenges, ifTrueThen });
    }
  }
  return out.slice(0, Math.max(0, count));
}
