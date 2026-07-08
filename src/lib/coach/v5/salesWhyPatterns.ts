import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import { outcomeLabel } from "@/lib/coach/v5/outcomeLabels";

/**
 * Live Sales Coach — cross-session WHY patterns (Sessions Phase 4). Reads a
 * rep's accumulated per-session why-hypotheses (Phase 3) + their outcomes and
 * surfaces RECURRING drivers tied to outcomes — the coach's deepening model
 * of how THIS rep sells (§3.6 make-learning-visible; §1.2 retrospective
 * across incidents, not one).
 *
 * §4 is STRUCTURAL here: a pattern is not surfaced until there is enough data
 * to be more than noise (MIN_WHYS). Below the gate it says so honestly —
 * never a fabricated pattern. Patterns are observations-with-evidence
 * (frequency + outcome association), held as hypotheses; the full validation
 * (does acting on a pattern change outcomes) is longitudinal, not claimed.
 *
 * §3.5 — every pattern is anchored to OUTCOMES, never to agreement.
 * §A18 — per-rep, for coaching, not a cross-agent ranking.
 * §A21 — reuses the control-exempt Sales-Coach LLM path.
 */

// §4/§3.2 data-sufficiency gate: below this many recorded whys, patterns
// would be noise, so none are surfaced.
export const MIN_WHYS = 4;
// F1 — stored pattern sets live as append-only per-agent events.
const PATTERNS_KIND = "coach.why_patterns_generated";
// Bound the look-back (recent sessions); the pattern is about the rep NOW.
const SCAN_LIMIT = 60;

export type WhyPattern = {
  pattern: string; // the recurring driver, one line
  frequency: string; // human: "in 4 of your last 7 sessions"
  outcomeAssociation: string; // tied to outcomes, e.g. "usually when you didn't close"
  kind: "strength" | "growth"; // is it helping or hurting
};

export type WhyPatterns = {
  hasEnoughData: boolean;
  whysAnalyzed: number;
  patterns: WhyPattern[];
  note: string; // §3.6 what the coach is learning; or the honest "keep going"
  // F3 (§3.4) — true when generation FAILED (error/parse), distinct from the
  // honest below-gate state.
  failed: boolean;
};

function buildPatternSystemPrompt(): string {
  return `You are a sales coach who has read a rep's OWN retrospective reads
across many finished calls — each a one-line "why this outcome happened",
paired with the actual OUTCOME. Your job: surface the RECURRING patterns —
what keeps driving this rep's results, for better or worse.

§4 — only name a pattern that GENUINELY RECURS across multiple sessions. Do
NOT invent a trend from one or two. If little recurs, return fewer patterns
(even zero) rather than manufacture them.

§3.5 — tie every pattern to the OUTCOMES it's associated with (e.g. "shows
up mostly on no-sale calls"). Patterns without an outcome link are noise.

§A18 — this is for THIS rep's growth, addressed to "you". Not a score.

§3.6 — you are showing the rep how you're coming to understand how THEY
sell. Warm, specific, honest.

For each pattern give:
- pattern: the recurring driver, one line.
- frequency: how often, in plain words ("in 4 of your last 8 calls").
- outcomeAssociation: which outcomes it tends to go with.
- kind: "strength" if it helps results, "growth" if it hurts them.

OUTPUT — respond with ONLY this JSON:
{
  "patterns": [
    { "pattern": "…", "frequency": "…", "outcomeAssociation": "…", "kind": "strength" | "growth" }
  ],
  "note": "one warm line on what you're learning about how this rep sells"
}`;
}

// Exported for test: it enforces §3.5 (a pattern with no outcomeAssociation is
// DROPPED — "patterns without an outcome link are noise") and §3.4 (malformed
// LLM output → null, never a crash). These are constitutional invariants worth
// regression-pinning.
export function parsePatterns(
  text: string
): { patterns: WhyPattern[]; note: string } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const note = typeof o.note === "string" ? o.note.trim() : "";
  const patterns: WhyPattern[] = Array.isArray(o.patterns)
    ? o.patterns
        .map((x) => {
          if (typeof x !== "object" || x === null) return null;
          const r = x as Record<string, unknown>;
          const pattern = typeof r.pattern === "string" ? r.pattern.trim() : "";
          const frequency =
            typeof r.frequency === "string" ? r.frequency.trim() : "";
          const outcomeAssociation =
            typeof r.outcomeAssociation === "string"
              ? r.outcomeAssociation.trim()
              : "";
          const kind = r.kind === "strength" ? "strength" : "growth";
          return pattern && outcomeAssociation
            ? { pattern, frequency, outcomeAssociation, kind }
            : null;
        })
        .filter((x): x is WhyPattern => x !== null)
    : [];
  return { patterns, note };
}

const belowGate = (whysAnalyzed: number, failed = false): WhyPatterns => ({
  hasEnoughData: false,
  whysAnalyzed,
  patterns: [],
  note: failed
    ? "Couldn't build your patterns right now — try again in a moment."
    : "Keep going — the coach needs a few more sessions with recorded outcomes and your own reads before real patterns can be trusted (not guessed).",
  failed,
});

/**
 * F1 — the CHEAP gather (no LLM): the rep's (why -> outcome) pairs. Reused by
 * the route to count available whys on load WITHOUT paying for an LLM call.
 * F5 — pairs on the outcome SNAPSHOT stored in the why event, falling back to
 * the current session outcome for older events (pre-snapshot).
 */
export async function gatherWhyPairs(args: {
  companyId: string;
  agentId: string;
}): Promise<{ driver: string; outcome: string }[]> {
  const admin = createAdminClient();
  const { data: sessionsData, error: sessErr } = await admin
    .from("coaching_sessions")
    .select("id, outcome")
    .eq("agent_id", args.agentId)
    .eq("company_id", args.companyId)
    .not("outcome", "is", null)
    .order("started_at", { ascending: false })
    .limit(SCAN_LIMIT);
  if (sessErr) {
    // §3.4 / live-error-vs-empty: without this, a transient error returns [] → the
    // caller hits below-gate and tells the rep "keep going, need more sessions" even
    // when they have dozens — a failure masquerading as an honest empty state.
    // eslint-disable-next-line no-console
    console.error(
      `[salesWhyPatterns.gatherWhyPairs] sessions read failed agent=${args.agentId}: ${sessErr.message}`
    );
  }
  const sessions = sessionsData ?? [];
  if (sessions.length === 0) return [];

  const outcomeBySession = new Map<string, string>();
  for (const s of sessions) {
    outcomeBySession.set(s.id as string, (s.outcome as string) ?? "");
  }
  const subjects = sessions.map((s) => `sales_session:${s.id}`);

  const { data: whyEvents, error: whyErr } = await admin
    .from("events")
    .select("subject, payload")
    .eq("kind", "coach.session_why_generated")
    .in("subject", subjects);
  if (whyErr) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesWhyPatterns.gatherWhyPairs] why-events read failed agent=${args.agentId}: ${whyErr.message}`
    );
  }

  const pairs: { driver: string; outcome: string }[] = [];
  for (const e of whyEvents ?? []) {
    const payload = e.payload as
      | { primaryDriver?: string; outcome?: string }
      | null;
    const driver = payload?.primaryDriver;
    if (!driver) continue;
    const sid = String(e.subject ?? "").replace("sales_session:", "");
    // F5 — the snapshot outcome; fall back to the current column for old events.
    const outcome = payload?.outcome ?? outcomeBySession.get(sid) ?? "";
    pairs.push({ driver, outcome });
  }
  return pairs;
}

export async function generateWhyPatterns(args: {
  companyId: string;
  agentId: string;
}): Promise<WhyPatterns> {
  try {
    const pairs = await gatherWhyPairs(args);

    // §4/§3.2 gate — not enough to trust a pattern.
    if (pairs.length < MIN_WHYS) return belowGate(pairs.length);

    const userMessage = `This rep's retrospective reads (why -> outcome), most recent first:

${pairs
  .map(
    (p, i) =>
      `${i + 1}. why: "${p.driver}"  ->  outcome: ${outcomeLabel(p.outcome) || "unknown"}`
  )
  .join("\n")}

Surface the recurring patterns tied to outcomes. JSON only.`;

    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt: buildPatternSystemPrompt(),
      userMessage,
    });
    // Suppression is control-gating, not a failure — Sales Coach is exempt so
    // this is an edge case; treat as below-gate (honest, not "failed").
    if (r.suppressed) return belowGate(pairs.length);

    const parsed = parsePatterns(r.text);
    // F3 (§3.4) — an unparseable response is a FAILURE, not "not enough data".
    if (!parsed) return belowGate(pairs.length, true);

    return {
      hasEnoughData: true,
      whysAnalyzed: pairs.length,
      patterns: parsed.patterns,
      note: parsed.note,
      failed: false,
    };
  } catch {
    // F3 (§3.4) — a real error, distinct from the honest below-gate state.
    return belowGate(0, true);
  }
}

/**
 * F1 — persist a generated pattern set as an append-only per-agent event so
 * the dashboard serves it on load WITHOUT an LLM call; regenerated only on an
 * explicit refresh. Only real (has-signal) sets are stored — never a gate or
 * failed state.
 */
export async function storeWhyPatterns(args: {
  companyId: string;
  agentId: string;
  result: WhyPatterns;
}): Promise<void> {
  if (!args.result.hasEnoughData) return;
  const admin = createAdminClient();
  const { error } = await admin.from("events").insert({
    company_id: args.companyId,
    actor: args.agentId,
    kind: PATTERNS_KIND,
    subject: `sales_agent:${args.agentId}`,
    payload: args.result,
  });
  if (error) {
    // Best-effort like every sibling runAndStore* — a failed cache-write must not
    // throw to the caller and fail the whole pattern generation (audit 2026-07-09).
    // eslint-disable-next-line no-console
    console.error(
      `[salesWhyPatterns.storeWhyPatterns] failed agent=${args.agentId}: ${error.message}`
    );
  }
}

/** F1 — the latest stored pattern set for a rep (no LLM), or null. */
export async function readStoredWhyPatterns(
  agentId: string
): Promise<WhyPatterns | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("payload")
    .eq("kind", PATTERNS_KIND)
    .eq("subject", `sales_agent:${agentId}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0];
  if (!row) return null;
  // Validate the stored shape before trusting it (audit 2026-07-09): a shape-drifted
  // old event cast blindly to WhyPatterns would crash a consumer doing
  // `.patterns.map(...)`. Require the load-bearing fields; else treat as absent.
  const p = row.payload as Partial<WhyPatterns> | null;
  if (!p || typeof p !== "object" || !Array.isArray(p.patterns)) return null;
  return p as WhyPatterns;
}
