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

// Human label for the look-back window (founder day/week view). 1 → "the last day", else "the last N days".
export function labelForDays(days: number): string {
  return days <= 1 ? "the last day" : `the last ${days} days`;
}
export const TEAM_BRIEF_EVENT_KIND = "coach.team_brief_generated";

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

export async function generateTeamTrainingBrief(
  companyId: string,
  periodDays: number = PERIOD_DAYS,
): Promise<TeamBriefResult> {
  const admin = createAdminClient();
  const periodLabel = labelForDays(periodDays);

  const { data: profs } = await admin.from("profiles").select("id, full_name").eq("company_id", companyId);
  const agents = (profs ?? []) as { id: string; full_name: string | null }[];
  const agentIds = agents.map((a) => a.id);
  if (agentIds.length === 0) {
    return { ok: false, reason: "insufficient", dissectCount: 0, periodLabel };
  }
  const nameById = new Map(agents.map((a) => [a.id, a.full_name ?? "Unnamed"]));

  const cutoff = new Date(Date.now() - periodDays * 86_400_000).toISOString();
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
    return { ok: false, reason: "insufficient", dissectCount, periodLabel: periodLabel };
  }

  // Pool the team's coaching content, frequency-ranked (the shared pattern the brief teaches).
  const pooled = aggregateDissectContent(rows);
  const growthAreas = rankByFrequency(pooled.growth, 8);
  const strategies = rankByFrequency(pooled.strategies, 8);
  const strengths = rankByFrequency(pooled.strengths, 6);
  if (growthAreas.length === 0 && strategies.length === 0 && strengths.length === 0) {
    return { ok: false, reason: "no_content", dissectCount, periodLabel: periodLabel };
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

  // Per-rep signal for the "one focus each" line: each active rep's OWN most-common growth area. This MUST reach the
  // prompt — without a rep's real name + their own signal the model has nothing to attribute a focus to, and every
  // name it guesses is dropped by the validSet filter below (repFocus was always empty). §A18: a growth direction per
  // rep, never a grade. Names are de-duplicated by actor; a rep with no growth point is omitted (no fabricated focus).
  const rowsByActor = new Map<string, typeof rows>();
  for (const row of rows) {
    const arr = rowsByActor.get(row.actor) ?? [];
    arr.push(row);
    rowsByActor.set(row.actor, arr);
  }
  const repSignals = [...rowsByActor.entries()]
    .map(([actor, actorRows]) => ({
      rep: nameById.get(actor) ?? "Unnamed",
      topFocus: rankByFrequency(aggregateDissectContent(actorRows).growth, 1)[0] ?? "",
    }))
    .filter((s) => s.topFocus);
  const validRepNames = repSignals.map((s) => s.rep);

  const systemPrompt = buildTeamBriefSystemPrompt();
  const userMessage = buildTeamBriefUserMessage({
    periodLabel: periodLabel,
    repCount: rowsByActor.size,
    dissectCount,
    growthAreas,
    strategies,
    strengths,
    repSignals,
    door,
  });

  const r = await debriefCoachV5({ companyId, systemPrompt, userMessage, controlExempt: true });
  if (!r.text || !r.text.trim()) {
    return { ok: false, reason: "llm_empty", dissectCount, periodLabel: periodLabel };
  }
  const brief = parseTeamBrief(r.text, periodLabel, validRepNames);
  if (!brief) return { ok: false, reason: "llm_empty", dissectCount, periodLabel: periodLabel };
  return { ok: true, brief, dissectCount, repCount: rowsByActor.size, periodLabel: periodLabel };
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

export type CachedTeamBrief = { result: TeamBriefResult; periodDays: number; generatedAt: string };

// Persist a generated brief as an append-only event (§3.1) so a manager sees the latest one "ready" without clicking
// Build — the overnight pre-generation writes it. Best-effort (a missed cache just means the manager clicks Build).
export async function storeTeamBrief(companyId: string, result: TeamBriefResult, periodDays: number): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("events").insert({
      company_id: companyId,
      actor: null, // system-generated (the cron), no human actor
      kind: TEAM_BRIEF_EVENT_KIND,
      subject: `team_brief:${companyId}`,
      payload: { result, period_days: periodDays, coach_version: "team-brief-v1" },
    });
  } catch {
    /* best-effort — a missed cache just means the manager clicks Build */
  }
}

// The most recent cached brief for a company (the pre-generated one). null if none yet.
export async function getLatestTeamBrief(companyId: string): Promise<CachedTeamBrief | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("payload, created_at")
    .eq("kind", TEAM_BRIEF_EVENT_KIND)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as { payload: unknown; created_at: unknown } | undefined;
  if (!row) return null;
  const p = (row.payload ?? {}) as Record<string, unknown>;
  const result = p.result as TeamBriefResult | undefined;
  if (!result || typeof result !== "object") return null;
  return {
    result,
    periodDays: typeof p.period_days === "number" ? p.period_days : PERIOD_DAYS,
    generatedAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

// Overnight pre-generation (cron): generate + cache the WEEK brief for every company with coaching activity in the
// window. SEQUENTIAL + capped so the burst of LLM calls stays bounded under maxDuration; a larger backlog just drains
// over nightly runs. Best-effort per company (one failure never stops the sweep).
export async function runTeamBriefPregeneration(cap = 10): Promise<{ companies: number; generated: number }> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - PERIOD_DAYS * 86_400_000).toISOString();
  const rows = await fetchAllPaged<{ company_id: string }>(
    (from, to) =>
      admin.from("events").select("company_id").eq("kind", "coach.dissect_generated").gte("created_at", cutoff).range(from, to),
    { label: "team-brief-pregen-companies" },
  ).catch(() => [] as { company_id: string }[]);
  const companyIds = [...new Set(rows.map((r) => String(r.company_id)).filter(Boolean))].slice(0, cap);
  let generated = 0;
  for (const companyId of companyIds) {
    try {
      const result = await generateTeamTrainingBrief(companyId, PERIOD_DAYS);
      if (result.ok) {
        await storeTeamBrief(companyId, result, PERIOD_DAYS);
        generated += 1;
      }
    } catch {
      /* best-effort per company */
    }
  }
  return { companies: companyIds.length, generated };
}
