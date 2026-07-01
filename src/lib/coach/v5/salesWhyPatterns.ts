import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";

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
const MIN_WHYS = 4;
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
};

const OUTCOME_LABELS: Record<string, string> = {
  sold: "Sold",
  follow_up: "Follow-up",
  no_sale: "No sale",
  no_contact: "No contact",
  undecided: "Undecided",
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

function parsePatterns(text: string): { patterns: WhyPattern[]; note: string } | null {
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

export async function generateWhyPatterns(args: {
  companyId: string;
  agentId: string;
}): Promise<WhyPatterns> {
  const belowGate = (whysAnalyzed: number): WhyPatterns => ({
    hasEnoughData: false,
    whysAnalyzed,
    patterns: [],
    note:
      "Keep going — the coach needs a few more sessions with recorded outcomes and your own reads before real patterns can be trusted (not guessed).",
  });

  try {
    const admin = createAdminClient();

    // The rep's own sessions that have an outcome recorded.
    const { data: sessionsData } = await admin
      .from("coaching_sessions")
      .select("id, outcome")
      .eq("agent_id", args.agentId)
      .eq("company_id", args.companyId)
      .not("outcome", "is", null)
      .order("started_at", { ascending: false })
      .limit(SCAN_LIMIT);
    const sessions = sessionsData ?? [];
    if (sessions.length === 0) return belowGate(0);

    const outcomeBySession = new Map<string, string>();
    for (const s of sessions) {
      outcomeBySession.set(s.id as string, (s.outcome as string) ?? "");
    }
    const subjects = sessions.map((s) => `sales_session:${s.id}`);

    // Their System-generated why for each of those sessions (Phase 3).
    const { data: whyEvents } = await admin
      .from("events")
      .select("subject, payload")
      .eq("kind", "coach.session_why_generated")
      .in("subject", subjects);

    const pairs: { driver: string; outcome: string }[] = [];
    for (const e of whyEvents ?? []) {
      const driver = (e.payload as { primaryDriver?: string } | null)
        ?.primaryDriver;
      if (!driver) continue;
      const sid = String(e.subject ?? "").replace("sales_session:", "");
      const outcome = outcomeBySession.get(sid) ?? "";
      pairs.push({ driver, outcome });
    }

    // §4/§3.2 gate — not enough to trust a pattern.
    if (pairs.length < MIN_WHYS) return belowGate(pairs.length);

    const userMessage = `This rep's retrospective reads (why -> outcome), most recent first:

${pairs
  .map(
    (p, i) =>
      `${i + 1}. why: "${p.driver}"  ->  outcome: ${OUTCOME_LABELS[p.outcome] ?? (p.outcome || "unknown")}`
  )
  .join("\n")}

Surface the recurring patterns tied to outcomes. JSON only.`;

    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt: buildPatternSystemPrompt(),
      userMessage,
    });
    if (r.suppressed) return belowGate(pairs.length);

    const parsed = parsePatterns(r.text);
    if (!parsed) return belowGate(pairs.length);

    return {
      hasEnoughData: true,
      whysAnalyzed: pairs.length,
      patterns: parsed.patterns,
      note: parsed.note,
    };
  } catch {
    return belowGate(0);
  }
}
