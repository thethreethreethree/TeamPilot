/**
 * Parse the /api/sales/demo/roleplay LLM output into { prospect, cue }.
 *
 * The model is asked to return compact JSON `{"prospect": "...", "cue": "..."}`. It usually complies,
 * but can wrap it in code fences or prose — so we extract the first {...} block. If there's no valid
 * JSON at all, the caller falls back (and strips any trailing cue/coach section so the coaching can
 * never leak into the prospect's mouth — audit F2, 2026-07-22). Extracted here so the parsing is unit-
 * tested rather than living inline in the route.
 */

export type RoleplayReply = { prospect: string; cue: string };

/** Extract {prospect, cue} from a model response, or null if no usable JSON object is present. */
export function parseRoleplayReply(text: string): RoleplayReply | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
      prospect?: unknown;
      cue?: unknown;
    };
    const prospect = typeof obj.prospect === "string" ? obj.prospect.trim() : "";
    const cue = typeof obj.cue === "string" ? obj.cue.trim() : "";
    if (!prospect) return null;
    return { prospect, cue };
  } catch {
    return null;
  }
}

/**
 * Fallback when the model returned no clean JSON: keep the prospect line but STRIP any trailing
 * "cue:"/"coach:" section, so a stray coaching sentence never appears as the prospect's words.
 */
export function prospectOnlyFallback(text: string): string {
  const prospectOnly = text
    .trim()
    .split(/\n(?=\s*(?:cue|coach)\s*[:\-])/i)[0]
    ?.replace(/^\s*(?:prospect|dana)\s*[:\-]\s*/i, "")
    .trim();
  return (prospectOnly || "Sorry — say that again?").slice(0, 600);
}
