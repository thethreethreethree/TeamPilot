import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tell a rep that something happened on one of their recordings.
 *
 * WHY A THIRD WRITER OF `manager_notifications` AND NOT A FOURTH COPY OF ONE. There are already
 * two: `gamification/notify.ts` (recipients are the agent's MANAGERS, upsert-ignore) and
 * `pitchScore/notifyCorrection.ts` (recipient is the agent, upsert-UPDATE). This module is the
 * second shape — recipient is the rep, refreshed on repeat — generalised over the two Recordings
 * types rather than pasted twice with the type string changed, which is the A21 shape.
 *
 * `notifyCorrection` is deliberately NOT folded in here. Its payload and its "what was corrected"
 * semantics are its own, it is covered by its own tests, and merging a working writer into a new
 * one to save a file is a refactor nobody asked for (§2, surface don't overtake).
 *
 * UPSERT-UPDATE on (recipient_id, type, session_id), matching 0261's header: four comments on one
 * recording are ONE alert that keeps moving to the top, not four bells for one sitting.
 *
 * BEST-EFFORT, ALWAYS. Never throws into the caller. The comment or the share request is already
 * written; failing the request because a bell could not be rung would undo nothing and lose the
 * caller's HTTP result.
 */

export type RecordingNoticeType = "recording_comment" | "recording_share_requested";

export type RecordingNotice = {
  companyId: string;
  /** The rep whose recording it is — recipient AND subject. */
  repId: string;
  /** Null when the pitch has no session; the bell renders without a link rather than not at all. */
  sessionId: string | null;
  type: RecordingNoticeType;
  payload: Record<string, unknown>;
};

export async function notifyRecordingEvent(notice: RecordingNotice): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("manager_notifications").upsert(
      {
        company_id: notice.companyId,
        recipient_id: notice.repId,
        agent_id: notice.repId,
        session_id: notice.sessionId,
        type: notice.type,
        payload: notice.payload,
        // Both explicit for 0257's reason: `created_at` has a DEFAULT, which only fires on INSERT,
        // so on the conflict path the row would keep the first event's timestamp and sort as old
        // news. A second comment has to come back to the top and back to unread.
        created_at: new Date().toISOString(),
        read_at: null,
      },
      { onConflict: "recipient_id,type,session_id" }
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[notifyRecordingEvent] ${notice.type} failed rep=${notice.repId} session=${notice.sessionId}: ${error.message}`
      );
      return false;
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[notifyRecordingEvent] ${notice.type} threw rep=${notice.repId}: ${e instanceof Error ? e.message : String(e)}`
    );
    return false;
  }
}
