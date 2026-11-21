/**
 * A sales session's channel — the ONE list (RSS Phase 1 step 1; migration 0275 adds 'phone').
 *
 * `coaching_sessions.context` was 'in_person' | 'video' (0070:36), hard-coded as a literal union in 13 files and
 * described to the AI by 8 prompts as `in_person ? "in-person, door-to-door" : "online video call"` — so a
 * phone call would have been called a video call to every engine. Every place now asks this module.
 *
 * D1 (decided 2026-11-15): the Remote Sales System is phone + video. Door-to-door ('in_person') is unchanged.
 */
export const SALES_CONTEXTS = ["in_person", "video", "phone"] as const;
export type SalesContext = (typeof SALES_CONTEXTS)[number];

/** The remote channels the RSS session lifecycle applies to (required outcome, stage chips). */
export const REMOTE_CONTEXTS = ["video", "phone"] as const satisfies readonly SalesContext[];

export const CONTEXT_LABEL: Record<SalesContext, string> = {
  in_person: "In-person",
  video: "Online video",
  phone: "Phone",
};

export function isSalesContext(v: unknown): v is SalesContext {
  return typeof v === "string" && (SALES_CONTEXTS as readonly string[]).includes(v);
}

export function isRemoteContext(v: unknown): v is (typeof REMOTE_CONTEXTS)[number] {
  return v === "video" || v === "phone";
}

/**
 * Whether the device mic hears ONLY the rep. True on a video or phone call: the prospect is on the far end, not
 * in the mic. Live attribution must then never invent a prospect turn (useLiveCoaching's isVideo override).
 */
export function micHearsRepOnly(v: SalesContext | null | undefined): boolean {
  return v === "video" || v === "phone";
}

/** How a prompt describes the channel to the model. */
export function contextPromptLine(v: SalesContext | null | undefined): string {
  return v === "in_person" ? "in-person, door-to-door" : v === "phone" ? "phone call" : "online video call";
}
