import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tell a rep that a manager corrected their Pitch Score.
 *
 * WHY THIS IS NOT `gamification/notify.ts`. That module writes the same table and does two things
 * this must not do: it resolves the AGENT'S MANAGERS as recipients (here the recipient is the
 * agent), and it upserts with `ignoreDuplicates` so a re-fire is a no-op. Ignoring a duplicate is
 * right for a strong session, which happens once; it is wrong for a correction, because a manager
 * can correct two items on one pitch minutes apart and the rep must be told the second time.
 *
 * So this writes with an UPDATE on conflict: one "your score was corrected" row per pitch per rep,
 * refreshed and marked unread again each time, carrying the latest total. The rep gets a live
 * notification rather than a pile of them, and nothing is silently dropped.
 *
 * BEST-EFFORT, ALWAYS. Never throws into the caller and never fails the request. The correction
 * itself has already been written and the score has already moved; failing the override because a
 * notification could not be inserted would undo nothing and lose the correction's HTTP result. A
 * failure here means the rep finds out the way they did before this existed — by opening the
 * pitch — which is a degradation, not a defect in the score.
 */

export type PitchCorrectionNotice = {
  companyId: string;
  /** The rep whose score moved. Recipient AND subject — unusual for this table, and the point. */
  repId: string;
  /** Null when the pitch has no session; the bell renders without a link rather than not at all. */
  sessionId: string | null;
  /** What was corrected, in the rubric's words, so the bell reads without a lookup. */
  itemLabel: string;
  /** The recomputed total, so the rep sees the new number in the alert itself. */
  total: number;
  /** Whether it still counts toward the leaderboard — an override can cross the 40-base line. */
  qualifying: boolean;
};

export async function notifyPitchCorrected(notice: PitchCorrectionNotice): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("manager_notifications").upsert(
      {
        company_id: notice.companyId,
        recipient_id: notice.repId,
        agent_id: notice.repId,
        session_id: notice.sessionId,
        type: "pitch_score_corrected",
        payload: {
          item_label: notice.itemLabel,
          total: notice.total,
          qualifying: notice.qualifying,
        },
        // Both explicit, and both are the reason this is an update rather than an ignore: a second
        // correction has to move the row back to the top and back to unread. `created_at` has a
        // default, which only applies on INSERT — on the conflict path it would keep the first
        // correction's timestamp and the alert would sort as old news.
        created_at: new Date().toISOString(),
        read_at: null,
      },
      { onConflict: "recipient_id,type,session_id" }
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[notifyPitchCorrected] insert failed rep=${notice.repId} session=${notice.sessionId}: ${error.message}`
      );
      return false;
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[notifyPitchCorrected] threw rep=${notice.repId}: ${e instanceof Error ? e.message : String(e)}`
    );
    return false;
  }
}
