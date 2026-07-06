import type { RippleEffect } from "./types";

const CONFIDENCES = new Set(["high", "medium", "low"]);

/**
 * Parse + VALIDATE the ripple-trace (§1.5) model output. Previously the caller
 * returned `parsed.ripples` unvalidated, so a malformed ripple — one missing its
 * subject, effect, or (Rule 2) its WHY, or with a bogus confidence — would flow
 * through. A ripple with no reasoning violates the method (every effect must
 * carry the reasoning chain), so it is DROPPED; an unrecognized confidence
 * defaults to the CONSERVATIVE "low" rather than claiming certainty on malformed
 * data (§3.4). Malformed / non-array output → []. Pure + dependency-free so it is
 * testable in isolation (rippleTrace.ts is server-only).
 */
export function parseRippleEffects(text: string): RippleEffect[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const ripples = (parsed as { ripples?: unknown }).ripples;
  if (!Array.isArray(ripples)) return [];

  const out: RippleEffect[] = [];
  for (const r of ripples) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const affectedSubject =
      typeof o.affectedSubject === "string" ? o.affectedSubject.trim() : "";
    const effect = typeof o.effect === "string" ? o.effect.trim() : "";
    const reasoning = typeof o.reasoning === "string" ? o.reasoning.trim() : "";
    // Rule 2: an effect without its WHY is not a valid ripple — drop it.
    if (!affectedSubject || !effect || !reasoning) continue;
    const confidence =
      typeof o.confidence === "string" && CONFIDENCES.has(o.confidence)
        ? (o.confidence as RippleEffect["confidence"])
        : "low";
    out.push({ affectedSubject, effect, confidence, reasoning });
  }
  return out;
}
