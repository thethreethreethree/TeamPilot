import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractMentions, stripMentionMarkup } from "./extract";

/**
 * Emit a `mention.created` chain event for every distinct teammate
 * tagged in a body of text. Called from API routes immediately after
 * the parent row (feedback, smoke-test result, etc.) is inserted, so
 * the event carries a stable `subject` pointing back at that row.
 *
 * Per §3.1, mentions are constitutional assets: who tagged whom,
 * about what, with what surrounding text. The chain captures that as
 * append-only signal so a future "mentions about me" inbox can derive
 * from it without us having to add a side-channel notifications table.
 *
 * Same user mentioned twice in the same row yields one event — the
 * audit trail wants one assertion of "you tagged Moses in feedback
 * X", not five.
 *
 * Failures are intentionally non-fatal: if the events insert fails,
 * we log to console and let the parent insert stand. Dropping the
 * whole feedback because the chain emit was flaky would be worse
 * than the lost mention event.
 */
export async function emitMentionEvents(opts: {
  supabase: SupabaseClient;
  companyId: string;
  actorId: string;
  bodyText: string;
  sourceKind: "feedback" | "smoke_test_result";
  sourceId: string;
}): Promise<{ emitted: number }> {
  const mentions = extractMentions(opts.bodyText);
  if (mentions.length === 0) return { emitted: 0 };

  const excerpt = stripMentionMarkup(opts.bodyText).slice(0, 280).trim();
  const subject = `${opts.sourceKind}:${opts.sourceId}`;

  const rows = mentions.map((m) => ({
    company_id: opts.companyId,
    actor: opts.actorId,
    kind: "mention.created",
    subject,
    payload: {
      target_user_id: m.userId,
      target_display_name: m.displayName,
      source_kind: opts.sourceKind,
      source_id: opts.sourceId,
      excerpt,
    },
  }));

  const { error } = await opts.supabase.from("events").insert(rows);
  if (error) {
    // Non-fatal — see comment above. Surface in logs so we notice if
    // mention emission is silently broken on a deploy.
    console.error("[mentions] emit failed:", error.message);
    return { emitted: 0 };
  }
  return { emitted: rows.length };
}
