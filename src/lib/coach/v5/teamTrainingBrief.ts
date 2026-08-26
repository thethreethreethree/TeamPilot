import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { debriefCoachV5 } from "@/lib/claude";
import { aggregateDissectContent } from "@/lib/coach/v5/coachAssessmentAggregate";
import {
  buildTeamBriefSystemPrompt,
  buildTeamBriefUserMessage,
  type TeamTrainingBrief,
} from "@/lib/coach/v5/teamTrainingBriefPrompt";

/**
 * Coach v5.0 — Team Training Brief engine (founder 2026-08-26). Reads the company's coaching signal for the last
 * PERIOD_DAYS (growth areas + strategy gaps pooled across the team's own Dissects, frequency-ranked) plus the team's
 * door activity, and asks the Coach LLM to write a short team training brief the manager runs in the next meeting.
 *
 * §3.4: below MIN_DISSECTS we do NOT call the LLM — there isn't enough team signal to teach from, and a brief
 * fabricated from one call is the dishonesty the product refuses. Honest `insufficient` is returned instead.
 */

const PERIOD_DAYS = 7;
const DISSECT_WINDOW = 200; // most-recent dissects across the team to pool (bounded)
const MIN_DISSECTS = 3; // below this, no brief — not enough team signal

export type TeamBriefResult =
  | { ok: true; brief: TeamTrainingBrief; dissectCount: number; repCount: number; periodLabel: string }
  | { ok: false; reason: "insufficient" | "no_content" | "llm_empty"; dissectCount: number; periodLabel: string };

const PERIOD_LABEL = `the last ${PERIOD_DAYS} days`;

// Rank names by frequency (most-common first), deduped, capped.
function rankByFrequency(names: string[], cap: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const n = (raw ?? "").trim();
    if (!n) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap).map(([n]) => n);
}

export async function generateTeamTrainingBrief(companyId: string): Promise<TeamBriefResult> {
  const admin = createAdminClient();

  const { data: profs } = await admin.from("profiles").select("id, full_name").eq("company_id", companyId);
  const agents = (profs ?? []) as { id: string; full_name: string | null }[];
  const agentIds = agents.map((a) => a.id);
  if (agentIds.length === 0) {
    return { ok: false, reason: "insufficient", dissectCount: 0, periodLabel: PERIOD_LABEL };
  }
  const nameById = new Map(agents.map((a) => [a.id, a.full_name ?? "Unnamed"]));

  const cutoff = new Date(Date.now() - PERIOD_DAYS * 86_400_000).toISOString();
  const { data: dissects } = await admin
    .from("events")
    .select("payload, created_at, actor")
    .eq("kind", "coach.dissect_generated")
    .in("actor", agentIds)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(DISSECT_WINDOW);
  const rows = (dissects ?? []) as { payload: unknown; created_at: unknown; actor: string }[];
  const dissectCount = rows.length;
  if (dissectCount < MIN_DISSECTS) {
    return { ok: false, reason: "insufficient", dissectCount, periodLabel: PERIOD_LABEL };
  }

  // Pool the team's coaching content, frequency-ranked (the shared pattern the brief teaches).
  const pooled = aggregateDissectContent(rows);
  const growthAreas = rankByFrequency(pooled.growth, 8);
  const strategies = rankByFrequency(pooled.strategies, 8);
  const strengths = rankByFrequency(pooled.strengths, 6);
  if (growthAreas.length === 0 && strategies.length === 0 && strengths.length === 0) {
    return { ok: false, reason: "no_content", dissectCount, periodLabel: PERIOD_LABEL };
  }

  // Team door activity (context) — best-effort sum over the company's reps; a read error just drops it to zeros.
  let door = { doorsKnocked: 0, presentations: 0, sold: 0 };
  try {
    const kpiRows = await fetchAllPaged<{ doors_knocked: number; sold: number; no_answer: number }>(
      (from, to) =>
        admin.from("rep_kpi_daily").select("doors_knocked, sold, no_answer").in("rep_id", agentIds).range(from, to),
      { label: "team-brief-door-kpi" },
    );
    let knocked = 0, sold = 0, noAnswer = 0;
    for (const r of kpiRows) {
      knocked += Number(r.doors_knocked ?? 0);
      sold += Number(r.sold ?? 0);
      noAnswer += Number(r.no_answer ?? 0);
    }
    door = { doorsKnocked: knocked, presentations: Math.max(0, knocked - noAnswer), sold };
  } catch {
    /* door context is optional — the coaching signal is the point */
  }

  const activeRepNames = [...new Set(rows.map((r) => nameById.get(r.actor) ?? "Unnamed"))];
  const systemPrompt = buildTeamBriefSystemPrompt();
  const userMessage = buildTeamBriefUserMessage({
    periodLabel: PERIOD_LABEL,
    repCount: activeRepNames.length,
    dissectCount,
    growthAreas,
    strategies,
    strengths,
    door,
  });

  const r = await debriefCoachV5({ companyId, systemPrompt, userMessage, controlExempt: true });
  if (!r.text || !r.text.trim()) {
    return { ok: false, reason: "llm_empty", dissectCount, periodLabel: PERIOD_LABEL };
  }
  const brief = parseTeamBrief(r.text, PERIOD_LABEL, activeRepNames);
  if (!brief) return { ok: false, reason: "llm_empty", dissectCount, periodLabel: PERIOD_LABEL };
  return { ok: true, brief, dissectCount, repCount: activeRepNames.length, periodLabel: PERIOD_LABEL };
}

// Parse + shape-guard the LLM JSON. Tolerant of a ```json fence; drops malformed items rather than throwing so a
// partially-valid brief still lands (§3.4 — show the real, verified parts, never a fabricated whole).
export function parseTeamBrief(text: string, periodLabel: string, validReps: string[]): TeamTrainingBrief | null {
  let raw: unknown;
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    raw = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const themes = Array.isArray(o.themes)
    ? o.themes
        .map((t) => ({ title: str((t as Record<string, unknown>)?.title), why: str((t as Record<string, unknown>)?.why) }))
        .filter((t) => t.title)
        .slice(0, 3)
    : [];
  const drillRaw = (o.drill ?? {}) as Record<string, unknown>;
  const drill = {
    title: str(drillRaw.title),
    steps: Array.isArray(drillRaw.steps) ? drillRaw.steps.map(str).filter(Boolean).slice(0, 6) : [],
  };
  const validSet = new Set(validReps);
  const repFocus = Array.isArray(o.repFocus)
    ? o.repFocus
        .map((r) => ({ rep: str((r as Record<string, unknown>)?.rep), focus: str((r as Record<string, unknown>)?.focus) }))
        .filter((r) => r.rep && r.focus && validSet.has(r.rep)) // never surface a rep the input didn't include
    : [];
  // A brief with neither a theme nor a drill carries no teachable signal → treat as empty.
  if (themes.length === 0 && !drill.title) return null;
  return { themes, drill, repFocus, periodLabel };
}
