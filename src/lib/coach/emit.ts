"use client";

import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import type { CoachCitation } from "./heuristics";

/**
 * Conversational Coach — chain-event emission.
 *
 * Fires three distinct event kinds against the §3.1 chain:
 *
 *   coach.suggestion_offered    — at least one heuristic matched a draft.
 *   coach.suggestion_accepted   — user refined the draft after seeing
 *                                 the citation (clicked Refine OR sent
 *                                 a message whose final text no longer
 *                                 triggers the same detector).
 *   coach.suggestion_dismissed  — user dismissed the chip or sent the
 *                                 message unchanged.
 *
 * The events together let the §4 readout answer: (a) how often does
 * each heuristic fire on coached topics, (b) what's the per-heuristic
 * accept vs dismiss split (informs whether a heuristic is mis-
 * calibrated — see A4), and most importantly (c) do coached topics
 * end with more durable resolutions than uncoached topics? (a) and
 * (b) are leading indicators; (c) is the consequence measure that
 * actually answers §4.
 *
 * Subject convention: `chat_topic:<id>` since drafts have no stable
 * id of their own. Multiple events per draft are normal — one for
 * each detector that fired, plus one for the final accept/dismiss.
 *
 * Errors are swallowed and logged: the Coach must never block a
 * draft from being sent, even if the chain is unavailable. The §4
 * readout can detect dropped events from chat_message volume vs
 * expected event volume; that's a separate health signal.
 */

/**
 * Subject convention (extended in v1.1 to span all communication
 * surfaces, not just chat):
 *   - chat_topic:<id>           — Coach fired inside a chat composer
 *   - task:<id>                  — Coach fired inside a task description / blocker
 *   - decision:<id>              — Coach fired inside a Decision Dialogue field
 *   - feedback:draft             — Coach fired in the feedback panel composer
 *                                  (draft because the row id doesn't exist yet)
 *   - smoke_test_result:draft    — Coach fired in a smoke test note draft
 *
 * The readout's "by surface" bucket key is the prefix before `:`.
 * Anything new added later picks up automatically.
 */
type Common = {
  /** Chain subject (e.g. "chat_topic:abc", "task:xyz", "feedback:draft"). */
  subject: string;
  citation: CoachCitation;
  draftExcerpt: string;
};

async function emitOne(kind: string, opts: Common): Promise<void> {
  if (!supabaseEnabled) return;
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile?.company_id) return;
    await supabase.from("events").insert({
      company_id: profile.company_id,
      actor: auth.user.id,
      kind,
      subject: opts.subject,
      payload: {
        heuristic_id: opts.citation.id,
        heuristic_source: opts.citation.source,
        heuristic_label: opts.citation.label,
        trigger_excerpt: opts.citation.triggerExcerpt,
        // Keep the broader draft excerpt small — we don't need the
        // whole message body for the readout, and shorter payloads
        // mean less data on the wire and in row size.
        draft_excerpt: opts.draftExcerpt.slice(0, 280),
      },
    });
  } catch (err) {
    // Non-fatal — see header comment. Console-log so we notice if
    // emission silently breaks on a deploy.
    console.error("[coach] event emit failed:", err);
  }
}

export const emitCoachOffered = (opts: Common) =>
  emitOne("coach.suggestion_offered", opts);

export const emitCoachAccepted = (opts: Common) =>
  emitOne("coach.suggestion_accepted", opts);

export const emitCoachDismissed = (opts: Common) =>
  emitOne("coach.suggestion_dismissed", opts);
