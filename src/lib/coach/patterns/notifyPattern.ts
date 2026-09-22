import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tell a rep their manager said something about one of their patterns.
 *
 * FOUNDER RULING 2026-09-22: a pattern-scoped bell, over two cheaper options. The reason it took
 * a migration is that the dedupe key did not fit — 0242's unique index is
 * `(recipient_id, type, session_id)` and a pattern has no session, so with `session_id` null
 * Postgres treats every row as distinct and three notes in one sitting would ring three bells.
 * 0262 adds `pattern_id` and a second unique index; this writer upserts against that one.
 *
 * ONE TYPE FOR THREE ACTIONS, and the payload says which. `coached`, `drill_assigned` and a plain
 * `note` all mean the same thing to the rep — *your manager said something about this pattern* —
 * and they land on the same screen. Three notification types would put three rows in one bell for
 * one conversation.
 *
 * UPSERT-UPDATE, like `notifyPitchCorrected` and for its reason: a manager who writes a note and
 * then marks it coached has done two things the rep should see, and the alert must come back to
 * the top and back to unread rather than being swallowed as a duplicate. `created_at` is explicit
 * because the column DEFAULT only fires on INSERT — on the conflict path the row would keep the
 * first event's timestamp and sort as old news.
 *
 * BEST-EFFORT, ALWAYS. The event is already on the record; failing the manager's action because a
 * bell could not be rung would lose the coaching and change nothing about the notification.
 */

export type PatternNotice = {
  companyId: string;
  /** The rep whose pattern it is — recipient AND subject. */
  repId: string;
  patternId: string;
  /** Which action the manager took. Renders the alert's wording without a second type. */
  action: "coached" | "drill_assigned" | "note";
  /** The rubric item's label, so the bell reads without a join. */
  patternLabel: string;
  /** The first line of what the manager wrote, when they wrote anything. */
  excerpt?: string | null;
};

export async function notifyPatternEvent(notice: PatternNotice): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("manager_notifications").upsert(
      {
        company_id: notice.companyId,
        recipient_id: notice.repId,
        agent_id: notice.repId,
        // Null, deliberately: a pattern spans many sessions and pinning it to one would be a
        // claim about which pitch this coaching is about. `pattern_id` below is the real key.
        session_id: null,
        pattern_id: notice.patternId,
        type: "pattern_coached",
        payload: {
          action: notice.action,
          pattern_id: notice.patternId,
          pattern_label: notice.patternLabel,
          ...(notice.excerpt ? { excerpt: notice.excerpt.slice(0, 160) } : {}),
        },
        created_at: new Date().toISOString(),
        read_at: null,
      },
      { onConflict: "recipient_id,type,pattern_id" }
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[notifyPatternEvent] ${notice.action} failed rep=${notice.repId} pattern=${notice.patternId}: ${error.message}`
      );
      return false;
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[notifyPatternEvent] threw rep=${notice.repId} pattern=${notice.patternId}: ${e instanceof Error ? e.message : String(e)}`
    );
    return false;
  }
}

/** The three manager actions a rep is told about. `fixed` is not one — it is good news they see. */
export const NOTIFIED_KINDS: ReadonlySet<string> = new Set(["coached", "drill_assigned", "note"]);

/**
 * Tell a rep's MANAGERS that they flagged a clip as wrong — the one alert that points back.
 *
 * FOUNDER RULING 2026-09-22. Every other notification added today points AT the rep: a
 * correction, a comment, a share request, a coaching note. This one is the rep talking, and it is
 * the only channel the product has for the scorer being wrong about a specific moment. A rep who
 * flags something and hears nothing learns not to flag — which does not remove the disagreement,
 * it removes the evidence of it, and leaves every board looking more reliable than it is.
 *
 * RECIPIENT RESOLUTION IS 0242'S, NOT A SECOND COPY. There is no per-agent manager FK, so a
 * "manager" is any company admin or sales-coach admin and the alert fans out to all of them —
 * exactly what `gamification/notify.ts` established and the reason that rule lives in one place.
 * Re-deriving "who manages this rep" here would be the §2.2 shape pointed at an audience.
 *
 * ITS OWN TYPE, not `pattern_coached`, because one pattern can carry a rep's dispute AND a
 * manager's coaching at the same time and they go to different people. Sharing a type would make
 * them collide on `(recipient_id, type, pattern_id)` and silently overwrite each other.
 *
 * Best-effort, like every writer here: the dispute is already on the record.
 */
export async function notifyClipDisputed(notice: {
  companyId: string;
  /** The rep who flagged it — the subject, and excluded from the recipients. */
  repId: string;
  patternId: string;
  patternLabel: string;
  note: string;
}): Promise<number> {
  try {
    const admin = createAdminClient();

    // 0242's rule, read from the same table with the same predicate.
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, role, sales_coach_role")
      .eq("company_id", notice.companyId);

    const recipients = (profiles ?? [])
      .filter(
        (p) =>
          ["CEO", "COO", "admin"].includes(String(p.role)) || p.sales_coach_role === "admin"
      )
      .map((p) => String(p.id))
      .filter((id) => id !== notice.repId);

    if (recipients.length === 0) return 0;

    // The rep's name, resolved once so the alert renders without a join.
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", notice.repId)
      .maybeSingle();

    const { error } = await admin.from("manager_notifications").upsert(
      recipients.map((recipient_id) => ({
        company_id: notice.companyId,
        recipient_id,
        agent_id: notice.repId,
        session_id: null,
        pattern_id: notice.patternId,
        type: "pattern_clip_disputed",
        payload: {
          agent_name: (prof?.full_name as string | null) ?? null,
          pattern_id: notice.patternId,
          pattern_label: notice.patternLabel,
          excerpt: notice.note.slice(0, 160),
        },
        created_at: new Date().toISOString(),
        read_at: null,
      })),
      { onConflict: "recipient_id,type,pattern_id" }
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[notifyClipDisputed] failed rep=${notice.repId} pattern=${notice.patternId}: ${error.message}`
      );
      return 0;
    }
    return recipients.length;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[notifyClipDisputed] threw rep=${notice.repId}: ${e instanceof Error ? e.message : String(e)}`
    );
    return 0;
  }
}
