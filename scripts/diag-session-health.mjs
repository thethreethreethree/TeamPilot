#!/usr/bin/env node
// READ-ONLY: session-health retrospective (§1.2) for the "sessions dropping / recording stopping / after-pitch
// not generating / not saved" escalation (2026-08-21). NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[2] || ".";
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const since = new Date(Date.now() - 21 * 864e5).toISOString();
const { data: sessions, error } = await sb
  .from("coaching_sessions")
  .select("id, context, status, started_at, ended_at, audio_asset_url")
  .gte("started_at", since)
  .order("started_at", { ascending: false })
  .limit(400);
if (error) { console.error("sessions:", error.message); process.exit(1); }

const ids = sessions.map((s) => s.id);
const segCount = new Map(), agentSeg = new Map(), custSeg = new Map();
for (let i = 0; i < ids.length; i += 50) {
  const { data: segs } = await sb.from("coaching_transcript_segments").select("session_id, speaker").in("session_id", ids.slice(i, i + 50));
  for (const s of segs ?? []) {
    segCount.set(s.session_id, (segCount.get(s.session_id) ?? 0) + 1);
    if (s.speaker === "agent") agentSeg.set(s.session_id, (agentSeg.get(s.session_id) ?? 0) + 1);
    if (s.speaker === "customer") custSeg.set(s.session_id, (custSeg.get(s.session_id) ?? 0) + 1);
  }
}
const dissect = new Set();
for (let i = 0; i < ids.length; i += 50) {
  const subs = ids.slice(i, i + 50).map((id) => `sales_session:${id}`);
  const { data: ev } = await sb.from("events").select("subject").eq("kind", "coach.dissect_generated").in("subject", subs);
  for (const e of ev ?? []) dissect.add(e.subject.replace("sales_session:", ""));
}

const dur = (s) => (s.ended_at ? (new Date(s.ended_at) - new Date(s.started_at)) / 1000 : null);
const isFull = (s) => (agentSeg.get(s.id) ?? 0) > 0 && (custSeg.get(s.id) ?? 0) > 0 && dissect.has(s.id);

// Breakdown by CONTEXT.
console.log(`\n=== ${sessions.length} sessions since ${since.slice(0,10)}, by CONTEXT ===`);
const byCtx = {};
for (const s of sessions) {
  const ctx = s.context ?? "null";
  (byCtx[ctx] ??= { n: 0, empty: 0, noAudio: 0, noDissect: 0, full: 0, over5m: 0 });
  const b = byCtx[ctx]; b.n++;
  if ((segCount.get(s.id) ?? 0) === 0) b.empty++;
  if (!s.audio_asset_url) b.noAudio++;
  if (!dissect.has(s.id)) b.noDissect++;
  if (isFull(s)) b.full++;
  if ((dur(s) ?? 0) > 300) b.over5m++;
}
for (const [ctx, b] of Object.entries(byCtx)) {
  const p = (x) => `${Math.round((x / b.n) * 100)}%`;
  console.log(`  ${ctx.padEnd(10)} n=${String(b.n).padStart(3)}  empty=${p(b.empty)}  noAudio=${p(b.noAudio)}  noDissect=${p(b.noDissect)}  FULL=${p(b.full)}  (>5m=${p(b.over5m)})`);
}

// Duration × emptiness: do LONG calls go empty? (worst case — a 10-min call → nothing)
console.log(`\n=== duration × transcript (ended only) ===`);
const buckets = [["<2m", 0, 120], ["2-5m", 120, 300], ["5-15m", 300, 900], [">15m", 900, 1e9]];
for (const [label, lo, hi] of buckets) {
  const grp = sessions.filter((s) => { const d = dur(s); return d != null && d >= lo && d < hi; });
  if (!grp.length) continue;
  const empty = grp.filter((s) => (segCount.get(s.id) ?? 0) === 0).length;
  const full = grp.filter(isFull).length;
  console.log(`  ${label.padEnd(6)} n=${String(grp.length).padStart(3)}  empty=${Math.round(empty/grp.length*100)}%  FULL=${Math.round(full/grp.length*100)}%`);
}

// Event-kind funnel for these sessions — where does the pipeline STOP?
console.log(`\n=== coach.* event funnel (subjects among these sessions) ===`);
const kinds = {};
for (let i = 0; i < ids.length; i += 50) {
  const subs = ids.slice(i, i + 50).map((id) => `sales_session:${id}`);
  const { data: ev } = await sb.from("events").select("kind, subject").in("subject", subs);
  for (const e of ev ?? []) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
}
for (const [k, c] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(34)} ${c}`);
