import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { readPatterns, teamWidePatterns, repChips } from "@/lib/coach/patterns/readPatterns";

/**
 * GET /api/coach/sales-session/patterns?repId=<uuid>
 *
 * Pattern Interrupt's read. One route for both boards, because they are the same data with a
 * different scope — the rep board is the manager board limited to one rep, which is how the guide
 * describes it ("the same Patterns screen limited to the rep's own patterns").
 *
 * WHO SEES WHAT IS THE DATABASE'S ANSWER, NOT THIS ROUTE'S. `patterns` RLS is "your own row, or
 * any in your company if you manage", so this passes the caller's client and asks for what the
 * caller may have. A rep who hand-crafts `?repId=<someone else>` gets an empty list from the
 * policy rather than a 403 from a check this route remembered to write — the same reason the
 * leaderboard route was built this way, and one fewer place for the access rule to drift (§2.2).
 *
 * The default is the caller's OWN patterns. Without it, a rep opening their board would get
 * whatever RLS allows — which for a rep is themselves, but for a manager would be the entire
 * company presented as theirs.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-patterns", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const explicitRep = req.nextUrl.searchParams.get("repId");

  /**
   * TEAM OR ONE REP, and the database decides which is allowed.
   *
   * `scope=team` omits the rep filter, so the `patterns` policy answers: a manager gets their
   * company, a rep gets themselves. That means a rep who hand-crafts `?scope=team` is not
   * rejected — they are simply handed their own patterns, which is the same thing they would have
   * got anyway. No second access check here to drift from the first (§2.2).
   *
   * The manager check below is therefore NOT the gate. It only decides whether to spend a name
   * lookup and build chips, both of which are meaningless for a single rep.
   */
  const wantsTeam = req.nextUrl.searchParams.get("scope") === "team" && !explicitRep;
  const manager = wantsTeam ? await requireSalesCoachManager(req) : null;
  const repId = explicitRep ?? (wantsTeam ? undefined : auth.user.id);

  // `readPatterns` reads the rows first and then fetches grades for exactly the reps who have a
  // pattern — so neither branch here has to know the rep list in advance.
  const read = await readPatterns(repId ? { repId } : {}, supabase);

  if (read === null) {
    // Never an empty board. "No patterns" about a rep whose patterns simply failed to load is the
    // confident-zero this codebase has an invariant against — and here it would read as praise.
    return NextResponse.json({ error: "Could not load patterns." }, { status: 500 });
  }

  /**
   * Names, for the team view only, and scoped the way the leaderboard route scopes them: to this
   * company AND to the rep ids already on the board. A manager learns the names of people whose
   * patterns they can already see and nothing else — this must not become a roster read.
   *
   * Degrades rather than fails. A board showing ids instead of names is worse; a 500 because a
   * name lookup failed would withhold the patterns themselves, which is worse still.
   */
  const chips = repId ? [] : repChips(read.patterns);
  const names = new Map<string, string>();
  if (manager && chips.length > 0) {
    const { data: profiles, error: nameError } = await createAdminClient()
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", manager.companyId)
      .in("id", chips.map((c) => c.repId));
    if (nameError) {
      console.error(`[coach-patterns] name lookup failed: ${nameError.message}`);
    }
    for (const p of profiles ?? []) {
      if (p.full_name) names.set(String(p.id), String(p.full_name));
    }
  }

  return NextResponse.json({
    repId: repId ?? null,
    /**
     * Per-rep open counts. These SUM to `counts.open` above, because both are counted from the
     * same verdicts — the board draws them stacked and a manager reads them together, so the day
     * they disagree is the day C8 is back.
     */
    chips: chips.map((c) => ({ ...c, fullName: names.get(c.repId) ?? null })),
    patterns: read.patterns,
    /**
     * Both senses, computed once. C8: the chips and the rep-detail tile count Improving as open
     * (`open`), and the rep-progress list's third number excludes it (`openNotImproving`, which
     * the board labels "still open"). Returned as two named fields so no surface has to subtract
     * one from the other and get the ruling wrong.
     */
    counts: read.counts,
    /** 3+ reps on one item. Empty for a rep-scoped read, which is correct — it is team data. */
    teamWide: teamWidePatterns(read.patterns),
    /** The read's own verdict on whether it hit its bound, never re-derived from the array. */
    capped: read.capped,
    /**
     * Detection has not run for this rep yet, as distinct from "no patterns found".
     *
     * A rep with no scored pitches and a rep who is doing everything right both get an empty
     * list, and they are opposite facts. The board must not congratulate the first one.
     */
    /**
     * Detection has not run for this rep yet, as distinct from "no patterns found" — two facts
     * that render identically and are opposite. Only meaningful for a single rep; on a team read
     * the board has chips to show instead.
     */
    scored: read.scored,
  });
}
