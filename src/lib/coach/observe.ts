"use client";

import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { detectAll } from "./heuristics";

/**
 * Post-time pattern observation. Called AFTER a message is durably
 * inserted (chat post, task post, feedback submit, smoke-test submit)
 * to log heuristic hits on the FINAL text into the §3.1 chain.
 *
 * This is the difference between Coach v1 (verdict on a draft) and
 * Coach v2 (mirror of patterns drawn from the record — A11):
 *
 *   v1 fired `coach.suggestion_offered` on each draft hit. Transient.
 *   v2 also fires `coach.pattern_observed` on each POST hit. Durable.
 *
 * The mirror chip in CoachPanel reads `coach.pattern_observed` events
 * for (user, heuristic, subject) and combines that count with the
 * current draft's hit to decide whether to surface. Counts in the
 * record are the System's only claim — facts, not judgments. The
 * user does all the judging.
 *
 * Non-fatal on failure: if event emission errors out we log to
 * console and let the post stand. A missing pattern_observed event
 * means the mirror chip will surface a beat later than it could
 * have. A failed post would be a much worse trade.
 */
export async function observePatterns(args: {
  subject: string;
  bodyText: string;
}): Promise<void> {
  if (!supabaseEnabled) return;
  if (!args.bodyText || args.bodyText.trim().length < 6) return;
  const hits = detectAll(args.bodyText);
  if (hits.length === 0) return;

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

    // One pattern_observed event per distinct heuristic that fired.
    // We deliberately do NOT collapse repeated occurrences within a
    // single post into one event — each detector hit is a separate
    // observation, so multiple hits within one message count
    // multiple times in the running pattern total.
    const rows = hits.map((c) => ({
      company_id: profile.company_id,
      actor: auth.user.id,
      kind: "coach.pattern_observed",
      subject: args.subject,
      payload: {
        heuristic_id: c.id,
        heuristic_source: c.source,
        trigger_excerpt: c.triggerExcerpt,
        body_excerpt: args.bodyText.slice(0, 280),
      },
    }));

    await supabase.from("events").insert(rows);
  } catch (err) {
    console.error("[coach] observePatterns failed:", err);
  }
}
