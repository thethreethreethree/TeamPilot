import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { callBriefCoach } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { loadLines, numberedTranscript, type Line } from "@/lib/coach/remote/followThrough";

/**
 * Remote Sales Macro Mode (docs/rss/MACRO-MODE-SPEC.md, 0303) — the call brief behind the Highlights and Next
 * Meeting tabs: key points, next steps, and for the next meeting an agenda, the things to bring up, and a checklist
 * the rep reviews.
 *
 * HONESTY GUARDS, enforced here, not trusted to the prompt (the follow-through read's discipline):
 *   · a key point, next step or "bring up" item must name a transcript line that exists — otherwise it is dropped,
 *     so nothing on the page can be invented; the agenda and checklist are plans, so they carry no line, but the
 *     checklist's due date is kept only when it is a real date between the call and 180 days after it;
 *   · every list is capped, and an empty list is a correct answer;
 *   · the brief is stored once per transcript version, so the page shows the same read every time.
 * The Call Brief paragraph itself is the existing factual summary (salesSummary) — not generated twice.
 */
export type BriefItem = { text: string; seq: number };
export type ChecklistItem = { text: string; due: string | null };
export type NextMeeting = { agenda: Array<{ text: string }>; bringUp: BriefItem[]; checklist: ChecklistItem[] };
export type CallBrief = { keyPoints: BriefItem[]; nextSteps: BriefItem[]; nextMeeting: NextMeeting };

export const CALL_BRIEF_SYSTEM = `You read the transcript of a sales call (phone or video) and prepare the rep's notes, as JSON only.

Return exactly:
{"key_points": [{"text": ..., "seq": ...}],
 "next_steps": [{"text": ..., "seq": ...}],
 "next_meeting": {"agenda": [{"text": ...}], "bring_up": [{"text": ..., "seq": ...}], "checklist": [{"text": ..., "due": ...}]}}

- key_points: up to 6 facts that matter about this prospect and their situation, needs or objections, each one plain
  sentence under 30 words. "seq" is the [number] of the line it rests on.
- next_steps: up to 5 things either side agreed would happen next, each under 20 words, with its line's seq.
- next_meeting.agenda: up to 5 short items for the next conversation with this prospect, in order.
- next_meeting.bring_up: up to 5 points from THIS call worth raising again (an open question, a concern not yet
  answered, something the prospect said they would check), each with the line's seq.
- next_meeting.checklist: up to 6 things the rep should do before the next meeting, imperative, under 15 words. "due"
  is a date YYYY-MM-DD only if a day was said or clearly implied (resolve it against the call date given), else null.

Use the prospect's and rep's own words where you can. Never invent something that was not said; an empty list is a
correct answer. Write for the rep, in plain words.`;

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Validate the model's JSON against the transcript. Pure. Drops anything the transcript does not support. */
export function parseCallBrief(raw: string, lines: Line[], callDate: Date): CallBrief {
  const empty: CallBrief = { keyPoints: [], nextSteps: [], nextMeeting: { agenda: [], bringUp: [], checklist: [] } };
  let j: unknown;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return empty;
  }
  if (!j || typeof j !== "object") return empty;
  const seqs = new Set(lines.map((l) => l.seq));
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const cited = (v: unknown, max: number, len: number): BriefItem[] =>
    arr(v)
      .slice(0, max)
      .flatMap((x) => {
        if (!x || typeof x !== "object") return [];
        const text = clip((x as { text?: unknown }).text, len);
        const seq = Number((x as { seq?: unknown }).seq);
        return text && Number.isInteger(seq) && seqs.has(seq) ? [{ text, seq }] : [];
      });
  const lo = callDate.getTime() - 86_400_000;
  const hi = callDate.getTime() + 180 * 86_400_000;
  const o = j as { key_points?: unknown; next_steps?: unknown; next_meeting?: unknown };
  const nm = (o.next_meeting && typeof o.next_meeting === "object" ? o.next_meeting : {}) as Record<string, unknown>;
  return {
    keyPoints: cited(o.key_points, 6, 300),
    nextSteps: cited(o.next_steps, 5, 200),
    nextMeeting: {
      agenda: arr(nm.agenda)
        .slice(0, 5)
        .flatMap((x) => {
          const text = clip(x && typeof x === "object" ? (x as { text?: unknown }).text : x, 160);
          return text ? [{ text }] : [];
        }),
      bringUp: cited(nm.bring_up, 5, 240),
      checklist: arr(nm.checklist)
        .slice(0, 6)
        .flatMap((x) => {
          if (!x || typeof x !== "object") return [];
          const text = clip((x as { text?: unknown }).text, 160);
          if (!text) return [];
          const due = (x as { due?: unknown }).due;
          let d: string | null = null;
          if (typeof due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(due)) {
            const t = Date.parse(`${due}T12:00:00Z`);
            if (Number.isFinite(t) && t >= lo && t <= hi) d = due;
          }
          return [{ text, due: d }];
        }),
    },
  };
}

/** The stored row → the shape the page reads. */
export function briefFromRow(row: {
  id: string;
  key_points: unknown;
  next_steps: unknown;
  next_meeting: unknown;
  transcript_version: number;
  created_at: string;
}) {
  const nm = (row.next_meeting ?? {}) as { agenda?: unknown; bring_up?: unknown; checklist?: unknown };
  return {
    id: String(row.id),
    transcriptVersion: Number(row.transcript_version),
    createdAt: String(row.created_at),
    keyPoints: (Array.isArray(row.key_points) ? row.key_points : []) as BriefItem[],
    nextSteps: (Array.isArray(row.next_steps) ? row.next_steps : []) as BriefItem[],
    nextMeeting: {
      agenda: (Array.isArray(nm.agenda) ? nm.agenda : []) as Array<{ text: string }>,
      bringUp: (Array.isArray(nm.bring_up) ? nm.bring_up : []) as BriefItem[],
      checklist: (Array.isArray(nm.checklist) ? nm.checklist : []) as ChecklistItem[],
    },
  };
}

type SessionRow = { id: string; company_id: string; agent_id: string; context: string; session_kind: string | null; started_at: string; audio_started_at: string | null };

/**
 * Pipeline + on-demand: brief the call once per transcript version and store it. Never throws. Returns the stored
 * row's id, or null (not a remote sales call, no transcript, AI suppressed/failed, migration missing).
 */
export async function runCallBrief(sessionId: string, client?: SupabaseClient): Promise<string | null> {
  try {
    const admin = client ?? createAdminClient();
    const { data: s } = await admin
      .from("coaching_sessions")
      .select("id, company_id, agent_id, context, session_kind, started_at, audio_started_at")
      .eq("id", sessionId)
      .maybeSingle();
    const session = s as SessionRow | null;
    if (!session || !isRemoteContext(session.context) || !isSalesCall(session.session_kind ?? "sales")) return null;
    const loaded = await loadLines(admin, sessionId, audioBaseIso(session.started_at, session.audio_started_at) ?? session.started_at);
    if (!loaded || loaded.lines.length < 2) return null;

    const { data: existing, error: exErr } = await admin
      .from("remote_call_briefs")
      .select("id")
      .eq("company_id", session.company_id)
      .eq("session_id", sessionId)
      .eq("transcript_version", loaded.version)
      .maybeSingle();
    if (exErr) {
      console.error(`[callBrief] read failed session=${sessionId}: ${exErr.message}`);
      return null; // includes "0303 not applied"
    }
    if (existing) return String(existing.id);

    const callDate = new Date(session.started_at);
    const r = await callBriefCoach({
      companyId: session.company_id,
      systemPrompt: CALL_BRIEF_SYSTEM + CONVERSATION_IS_DATA,
      userMessage: `Call date: ${callDate.toISOString().slice(0, 10)}\n\nTranscript:\n${numberedTranscript(loaded.lines)}`,
      sessionId,
    });
    if (r.suppressed || !r.text.trim()) return null;
    const brief = parseCallBrief(r.text, loaded.lines, callDate);

    // A plain insert: the table has an UPDATE rule, so ON CONFLICT is refused (0281's lesson); the unique constraint
    // is the once-per-version guarantee and a concurrent writer's row is read back on 23505.
    const { data: row, error } = await admin
      .from("remote_call_briefs")
      .insert({
        session_id: sessionId,
        company_id: session.company_id,
        rep_id: session.agent_id,
        transcript_version: loaded.version,
        key_points: brief.keyPoints,
        next_steps: brief.nextSteps,
        next_meeting: { agenda: brief.nextMeeting.agenda, bring_up: brief.nextMeeting.bringUp, checklist: brief.nextMeeting.checklist },
      })
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") {
      const { data: raced } = await admin
        .from("remote_call_briefs")
        .select("id")
        .eq("company_id", session.company_id)
        .eq("session_id", sessionId)
        .eq("transcript_version", loaded.version)
        .maybeSingle();
      return raced ? String(raced.id) : null;
    }
    if (error) {
      console.error(`[callBrief] store failed session=${sessionId}: ${error.message}`);
      return null;
    }
    return row ? String(row.id) : null;
  } catch (err) {
    console.error(`[callBrief] failed session=${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
