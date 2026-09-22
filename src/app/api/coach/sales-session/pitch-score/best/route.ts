import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * GET /api/coach/sales-session/pitch-score/best?period=…&limit=3 — a rep's highest counted pitches.
 *
 * WHY IT EXISTS. The rep dashboard's Progress board draws "YOUR BEST PITCHES" as three cards, each
 * with a score, a date and a way into that pitch's detail. Nothing served that. `aggregatePitches`
 * produces `bestPitchScore` — ONE number, from `reduce(Math.max)` — which is enough for the gauge's
 * "Best 106.5" and carries no list, no dates and no ids. The mobile board shipped without the cards
 * rather than inventing them.
 *
 * QUALIFYING ONLY, and that is the whole ranking rule. A pitch counts toward the leaderboard only if
 * it reached Discovery and scored at least `QUALIFYING_MIN_BASE` on the base. A rep's "best" must
 * mean the same thing their total means, or the board would celebrate a pitch that contributed
 * nothing to it — and the mockup's own list has a 44.0 labelled "Not counted" sitting in the
 * recordings beside it.
 *
 * RANKED BY TOTAL, which is what the sheet promises: *"Best Pitch award goes to the highest single
 * score."* Total, not base — the bonus is part of the score a rep competes on.
 *
 * `session_id` MAY BE NULL. The column is `on delete set null`, so a pitch outlives the session it
 * came from. The row is still returned, because the SCORE is real and a rep's best pitch does not
 * stop existing when its recording is purged — the client shows the card without a link rather than
 * offering a tap that goes nowhere.
 *
 * CALLER-SCOPED, so RLS decides. 0252 grants select on `pitch_scores` to the rep themself or a Sales
 * Coach manager, which is exactly the rule this route wants. There is no service-role read and no
 * need for one: a rep asking for their own best pitches is the only shape this has.
 */

const PERIODS = new Set(["day", "week", "month", "all"]);
/** Three cards on the board. Bounded so a caller cannot ask for the whole history. */
const MAX_LIMIT = 10;
const DEFAULT_LIMIT = 3;

/** Inclusive ISO start for a period, or undefined for all time. */
function fromFor(period: string): string | undefined {
  if (period === "all") return undefined;
  const d = new Date();
  if (period === "day") d.setUTCHours(0, 0, 0, 0);
  else d.setUTCDate(d.getUTCDate() - (period === "week" ? 7 : 30));
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "pitch-score-best", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const sb = callerScopedDb(req) ?? (await createClient());
  const params = req.nextUrl.searchParams;

  const requested = params.get("period") ?? "week";
  const period = PERIODS.has(requested) ? requested : "week";

  const askedLimit = Number.parseInt(params.get("limit") ?? "", 10);
  const limit =
    Number.isFinite(askedLimit) && askedLimit > 0 ? Math.min(askedLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  // Defaults to the caller's own pitches. Without this a manager's request with no repId would rank
  // the whole company's pitches and present them as one person's best.
  const repId = params.get("repId") ?? ctx.userId;

  let q = sb
    .from("pitch_scores")
    .select("id, session_id, recorded_at, total, outcome")
    .eq("rep_id", repId)
    .eq("qualifying", true)
    .order("total", { ascending: false })
    /*
      A DETERMINISTIC TIE-BREAK, because these cards are TAPPABLE.

      Ranked on total alone, two pitches with the same score order however Postgres feels, and the
      order can differ between reads. That is harmless for a number and not harmless for a link: a
      rep taps "97 points" expecting the pitch they were just looking at and opens a different one.
      Newest first, so a tie resolves to the more recent pitch every time.
    */
    .order("recorded_at", { ascending: false })
    .limit(limit);

  const from = fromFor(period);
  if (from) q = q.gte("recorded_at", from);

  const { data, error } = await q;
  if (error) {
    // INV22 honesty: a failed read must not render as "you have no good pitches". Surface it.
    console.error("[pitch-score/best] read failed:", error.message);
    return NextResponse.json({ error: "Could not load your best pitches." }, { status: 500 });
  }

  return NextResponse.json({
    period,
    pitches: (data ?? []).map((r) => ({
      pitchId: r.id as string,
      /** Null when the session was deleted. The score survives it; the link does not. */
      sessionId: (r.session_id as string | null) ?? null,
      recordedAt: r.recorded_at as string,
      total: Number(r.total),
      outcome: (r.outcome as string | null) ?? null,
    })),
  });
}
