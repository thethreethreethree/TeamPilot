import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import type { SessionFailureCode } from "./state";
export { FAILURE_LABEL, type SessionFailureCode } from "./state";

/**
 * The writer of `session_failures` (migration 0275; RSS Phase 1 step 4, Gong F5.9): the closed reason a REMOTE
 * session was not analysed or scored, so a manager sees "No speech heard" instead of a session that silently
 * never became ready.
 *
 * D1 (decided): remote = phone + video. A door session is never recorded here — its failures stay on the Door
 * Log's own surfaces, unchanged.
 *
 * Best-effort, never throws: the caller is already handling the failure; this only makes it visible. One row
 * per (session, reason): a retry that fails the same way again (the drain re-runs) does not stack duplicates.
 * Before 0275 is applied the table does not exist; that is logged, nothing else.
 */
export async function recordSessionFailure(args: {
  sessionId: string;
  companyId: string;
  /** The session's channel; only phone/video are recorded. Pass it when known to save a read. */
  context?: string | null;
  reason: SessionFailureCode;
  detail?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    let context = args.context;
    if (context === undefined) {
      const { data } = await admin
        .from("coaching_sessions")
        .select("context")
        .eq("id", args.sessionId)
        .eq("company_id", args.companyId)
        .maybeSingle();
      context = (data?.context as string | null) ?? null;
    }
    if (!isRemoteContext(context)) return;

    const { data: existing } = await admin
      .from("session_failures")
      .select("id")
      .eq("session_id", args.sessionId)
      .eq("company_id", args.companyId)
      .eq("reason_code", args.reason)
      .limit(1);
    if ((existing?.length ?? 0) > 0) return;

    const { error } = await admin.from("session_failures").insert({
      session_id: args.sessionId,
      company_id: args.companyId,
      reason_code: args.reason,
      detail: args.detail ?? null,
    });
    if (error) console.error(`[session-failures] not recorded (${args.reason}) session=${args.sessionId}: ${error.message}`);
  } catch (err) {
    console.error(`[session-failures] threw (${args.reason}) session=${args.sessionId}:`, err);
  }
}
