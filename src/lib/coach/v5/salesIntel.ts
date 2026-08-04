import "server-only";
// Prompt-injection fence — the transcript carries untrusted CUSTOMER speech.
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { dissectCoachV5 } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TranscriptSegment, SalesContext } from "@/lib/data/salesCoach";
import type { SalesIntel } from "./summaryTypes";
export type { SalesIntel } from "./summaryTypes";
import {
  buildSalesIntelSystemPrompt,
  buildSalesIntelUserMessage,
} from "./salesIntelPrompt";

/**
 * Conversation-intelligence engine (founder 2026-07-07): extracts the
 * competitors named + the topics discussed, in ONE LLM call. Manager-visible
 * observation (not a private score), composed onto the summary surfaces (§A16 —
 * does not fork the summary engine). Never throws; thin/failed input returns the
 * honest empty state (§3.4).
 */

const EMPTY: SalesIntel = { competitors: [], topics: [] };

// Founder 2026-08-05: NO minimum-length gate — every session yields its intel, however
// short. Only a genuinely empty transcript (0 segments) is excluded (§3.4).
const MIN_SEGMENTS = 1;
const MAX_ITEMS = 8; // bound pathological model output

export async function generateSalesIntel(args: {
  companyId: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<SalesIntel> {
  try {
    if (args.segments.length < MIN_SEGMENTS) return EMPTY;
    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt: buildSalesIntelSystemPrompt() + CONVERSATION_IS_DATA,
      userMessage: buildSalesIntelUserMessage({
        context: args.context,
        segments: args.segments,
      }),
    });
    if (r.suppressed) return EMPTY;
    const parsed = parseIntel(r.text) ?? EMPTY;
    // §3.4 grounding (audit 2026-07-07): COMPETITORS are a consequential,
    // manager-visible factual claim ("X was mentioned") — drop any name that
    // does NOT actually appear in the transcript, so the one extraction engine
    // that could otherwise fabricate is anchored like its siblings. TOPICS are
    // legitimately paraphrased (can't be substring-matched) and stay prompt-
    // grounded.
    return groundCompetitors(parsed, args.segments);
  } catch {
    return EMPTY;
  }
}

/** Keep only competitor names that actually appear in the transcript as a bounded
 *  token (case-insensitive) — a raw substring would false-positive a short name
 *  inside an unrelated word (e.g. "Cox" in "coxswain"). Exported for test. */
export function groundCompetitors(
  intel: SalesIntel,
  segments: TranscriptSegment[]
): SalesIntel {
  const haystack = segments.map((s) => s.text.toLowerCase()).join(" \n ");
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const competitors = intel.competitors.filter((c) => {
    const name = c.trim().toLowerCase();
    if (!name) return false;
    // Bounded by a non-word char or a string edge on each side.
    return new RegExp(`(^|\\W)${escape(name)}(\\W|$)`).test(haystack);
  });
  return { competitors, topics: intel.topics };
}

/** Exported for test: strings only, trimmed, de-duped (case-insensitive),
 *  bounded, and malformed output degrades honestly to empty. */
export function parseIntel(text: string): SalesIntel | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const clean = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of v) {
      if (typeof item !== "string") continue;
      const t = item.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= MAX_ITEMS) break;
    }
    return out;
  };
  return { competitors: clean(o.competitors), topics: clean(o.topics) };
}

/**
 * Generate the intel AND persist it as an append-only event (§3.1), mirroring
 * runAndStoreSummary/Pivot/Moments so BOTH the summarize route and finalize
 * produce it. Manager-visible (founder decision 2026-07-07 — an observation, not
 * a private score). Best-effort on the event store. Returns the intel, or null
 * when there's nothing to show.
 */
export async function runAndStoreIntel(args: {
  companyId: string;
  actorId: string;
  sessionId: string;
  context?: SalesContext;
  segments: TranscriptSegment[];
}): Promise<SalesIntel | null> {
  const intel = await generateSalesIntel({
    companyId: args.companyId,
    context: args.context,
    segments: args.segments,
  });
  if (intel.competitors.length === 0 && intel.topics.length === 0) return null;

  try {
    const admin = createAdminClient();
    await admin.from("events").insert({
      company_id: args.companyId,
      actor: args.actorId,
      kind: "coach.session_intel_generated",
      subject: `sales_session:${args.sessionId}`,
      payload: { intel, coach_version: "intel-v1" },
    });
  } catch {
    /* best-effort — the intel still returns */
  }
  return intel;
}
