#!/usr/bin/env node
// ONE-TIME BACKFILL (first run 2026-08-28, founder-approved) — populate the whole-call OBJECTION TALLY into
// existing after_pitch_summaries so the Objections KPI (added the same day) shows history instead of "building".
//
// On-record per §3.1 (a prod-mutating data operation is an asset, not a throwaway). Re-runnable safely for a NEW
// company's historical sessions: it only touches sessions whose LATEST summary has scores but no `objections`.
//
// Mechanism — cheapest faithful path: 1 focused LLM call/session (JUST the tally, mirroring salesMomentsPrompt.ts's
// objection instruction), MERGED into each session's LATEST payload (preserves scores/moments/narrative), and
// appended as a new summary. after_pitch_summaries is APPEND-ONLY, and the KPI reads take the latest per session
// (see latestSummaryPerSession), so the tallied row becomes the current one. Additive + safe (never edits a row).
//
// NOTE: reasoning-model starvation is real here — max_tokens 7500 + a 4500-char transcript slice were tuned so the
// tally content isn't eaten by reasoning (a lower budget returned empty content / finish_reason:length). If the
// live salesMomentsPrompt objection wording changes, update SYS below to match (deliberate drift risk of a copy).
//
// Requires .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEEPSEEK_API_KEY).
// Usage:  node scripts/backfill-objection-tally.mjs [--run] [--limit=N]
//   default = DRY RUN (no writes): identifies sessions, tallies the first few, prints results.
//   --run   = executes (INSERTs the merged summaries).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const args = process.argv.slice(2);
const RUN = args.includes("--run");
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || (RUN ? 1000 : 3));
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// The objection-tally instruction, mirroring salesMomentsPrompt.ts so backfilled tallies match future live ones.
const SYS = `You read a diarized door-to-door sales pitch transcript and TALLY the objections across the WHOLE call.
- "raised" = the number of DISTINCT objections or real pushbacks the CUSTOMER voiced (price, timing, "not interested", "I need to think", trust, "I already have someone"). Count each distinct concern once; do NOT count simple questions or neutral clarifications. A call with no pushback is 0.
- "resolved" = how many of those the rep ADDRESSED well enough that the customer moved PAST it (dropped it, warmed, or advanced), NOT the ones left hanging or that ended the call. resolved can never exceed raised. If unsure whether one was resolved, do not count it as resolved.
Return ONLY JSON: {"raised": <int>, "resolved": <int>}`;

async function tally(transcript) {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [{ role: "system", content: SYS }, { role: "user", content: `TRANSCRIPT:\n\n${transcript.slice(0, 4500)}\n\nReturn the JSON tally only.` }],
      max_tokens: 7500, // reasoning model: reasoning burns tokens BEFORE content — give ample headroom (was 2000 → truncated)
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`deepseek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content ?? "";
  // Robust extraction: pull the first {...raised...} object even if the model wrapped it in prose/fences.
  const match = content.match(/\{[^{}]*"raised"[\s\S]*?\}/);
  if (!match) { console.log(`    (no JSON; finish=${j.choices?.[0]?.finish_reason} contentLen=${content.length})`); return null; }
  let p; try { p = JSON.parse(match[0]); } catch { return null; }
  if (typeof p?.raised !== "number") return null;
  const raised = Math.max(0, Math.round(p.raised));
  const resolved = Math.min(raised, Math.max(0, Math.round(typeof p.resolved === "number" ? p.resolved : 0)));
  return { raised, resolved };
}

// 1) latest after_pitch_summary per session, needing a tally (has a payload with scores, no objections yet).
const { data: aps, error } = await sb.from("after_pitch_summaries").select("id, session_id, company_id, agent_id, created_at, payload").order("created_at", { ascending: true });
if (error) { console.log("ERR reading summaries:", error.message); process.exit(1); }
const latest = new Map();
for (const r of aps ?? []) latest.set(r.session_id, r); // ascending → last = latest
const need = [...latest.values()].filter((r) => {
  const pl = r.payload || {};
  const hasScores = Array.isArray(pl.scores) && pl.scores.length > 0;
  const hasTally = pl.objections && typeof pl.objections.raised === "number";
  return hasScores && !hasTally;
});
console.log(`${latest.size} sessions with a summary · ${need.length} need an objection tally · mode=${RUN ? "RUN (writes)" : "DRY RUN"} · limit=${LIMIT}`);

let done = 0, wrote = 0, skipped = 0;
for (const r of need.slice(0, LIMIT)) {
  const { data: segs } = await sb.from("coaching_transcript_segments").select("speaker, text, seq").eq("session_id", r.session_id).order("seq");
  if (!segs || segs.length === 0) { skipped++; continue; }
  const transcript = segs.map((s) => `${s.speaker === "agent" ? "REP" : s.speaker === "customer" ? "CUSTOMER" : "UNKNOWN"}: ${s.text}`).join("\n");
  let t; try { t = await tally(transcript); } catch (e) { console.log(`  ${r.session_id.slice(0, 8)} LLM error: ${e.message}`); skipped++; continue; }
  if (!t) { console.log(`  ${r.session_id.slice(0, 8)} unparseable tally, skipped`); skipped++; continue; }
  done++;
  console.log(`  ${r.session_id.slice(0, 8)} agent=${String(r.agent_id).slice(0, 8)} -> raised=${t.raised} resolved=${t.resolved}${RUN ? " [writing]" : ""}`);
  if (RUN) {
    const { error: insErr } = await sb.from("after_pitch_summaries").insert({
      session_id: r.session_id, company_id: r.company_id, agent_id: r.agent_id,
      payload: { ...r.payload, objections: t }, // MERGE: preserve scores/moments/narrative, add the tally
    });
    if (insErr) console.log(`    INSERT error: ${insErr.message}`); else wrote++;
  }
}
console.log(`\ntallied=${done} wrote=${wrote} skipped=${skipped}${RUN ? "" : "  (dry run — no writes; re-run with --run to execute)"}`);
