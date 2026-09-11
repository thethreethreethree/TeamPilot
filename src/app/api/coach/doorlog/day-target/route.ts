import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { computeLocalSalesDate } from "@/lib/coach/doorlog/salesDay";
import { getOrFreezeDayTarget } from "@/lib/coach/doorlog/dayTargetData";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * GET /api/coach/doorlog/day-target?tz=<IANA tz> — the door home screen's data (Phase 07).
 *
 * Returns the FROZEN day target (getOrFreezeDayTarget — computed once at the rep's first open) plus TODAY's
 * three funnel counts read from the EXISTING door_knocks + pitches (INSPECTION.md Q2). Caller-scoped: a rep
 * gets only their own (RLS). `tz` is the rep's device timezone so "today" is their local sales day, not UTC.
 *
 * Migration-coupling (A34): the day-target tables land in 0247. Until it applies, this degrades to a clear
 * "not available yet" rather than a bare 500.
 */
export async function GET(req: NextRequest) {
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: prof } = await sb.from("profiles").select("company_id, full_name").eq("id", auth.user.id).maybeSingle();
  const companyId = (prof?.company_id as string | null) ?? null;
  const repName = (prof?.full_name as string | null) ?? null;
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  const tz = new URL(req.url).searchParams.get("tz") || "UTC";
  const localDate = computeLocalSalesDate(new Date(), tz);

  try {
    const target = await getOrFreezeDayTarget({ db: sb, repId: auth.user.id, companyId, localDate });

    /*
      Today's three counts, ALL from door_knocks and all on the rep's local day.

      PRESENTATIONS USED TO BE COUNTED FROM `pitches` — recorded audio. Doors and sold came from
      door_knocks, so the middle of the funnel was measured from a different table than the two ends,
      and a door logged as sold without a recording never counted as a presentation.

      The founder's own home screen showed the result on 11 September 2026: "0 of 9 PRESENTATIONS"
      beside "9 of 1 SOLD" — nine sales from zero presentations, which cannot happen. The screen
      presents these three as a funnel, and a funnel asserts containment the two sources could not
      guarantee.

      A presentation is now a door where the rep actually spoke to somebody: every outcome except
      `no_answer`. Founder's decision, 11 September. Across production that moves the count from 86
      to 264 against 723 knocks — the close ratio falls from an implausible 78% to about 25%, which
      is the more believable number and always was.

      THE DOOR TARGET BARELY MOVES, which is why this is safe to change under a live team:
      `doorsTarget = ceil(soldTarget / close) / contact`, and with close = sold/presentations and
      contact = presentations/doors the presentations term cancels — only the intermediate ceil()
      survives. What genuinely changes is the PRESENTATIONS target, which stops being derived from a
      denominator that only ever saw the doors somebody remembered to record.
    */
    const [doorsRes, soldRes, presRes] = await Promise.all([
      sb.from("door_knocks").select("id", { count: "exact", head: true }).eq("rep_id", auth.user.id).eq("local_date", localDate),
      sb.from("door_knocks").select("id", { count: "exact", head: true }).eq("rep_id", auth.user.id).eq("outcome", "sold").eq("local_date", localDate),
      sb.from("door_knocks").select("id", { count: "exact", head: true }).eq("rep_id", auth.user.id).neq("outcome", "no_answer").eq("local_date", localDate),
    ]);
    if (doorsRes.error || soldRes.error || presRes.error) {
      // INV22 honesty: a failed count must not render as a fabricated 0 — surface the failure.
      console.error("[doorlog/day-target] count read failed");
      return NextResponse.json({ error: "Couldn't load today's numbers." }, { status: 500 });
    }

    return NextResponse.json({
      localDate,
      repName,
      target,
      today: { doors: doorsRes.count ?? 0, presentations: presRes.count ?? 0, sold: soldRes.count ?? 0 },
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isMissingColumnError(err, "sales_goal") || isMissingColumnError(err, "doors_target") || /rep_day_target|rep_daily_sales_goal/.test(err.message ?? "")) {
      return NextResponse.json({ error: "The door screen isn't available yet — the update is still rolling out.", unavailable: true }, { status: 503 });
    }
    console.error("[doorlog/day-target] failed:", err.message);
    return NextResponse.json({ error: "Couldn't load the door screen." }, { status: 500 });
  }
}
