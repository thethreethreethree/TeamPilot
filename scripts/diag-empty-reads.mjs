#!/usr/bin/env node
// READ-ONLY diagnostic (2026-08-14): why do some reps get an empty "Your read"
// (after_pitch narrative.hasSignal=false) while others don't?
// Retrospective (§1.2): pull the actual record — affected sessions, their companies,
// and each company's corpus size — and correlate. NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1) Recent after-pitch summaries
const { data: rows, error } = await sb
  .from("after_pitch_summaries")
  .select("session_id, company_id, agent_id, payload, created_at")
  .order("created_at", { ascending: false })
  .limit(200);
if (error) { console.error("summaries query failed:", error.message); process.exit(1); }

console.log(`\n=== ${rows.length} recent after_pitch_summaries ===`);
const byCompany = new Map();
let emptyNarr = 0, hasNarr = 0;
for (const r of rows) {
  const p = r.payload || {};
  const narr = p.narrative || {};
  const nSig = !!narr.hasSignal;
  const nStr = Array.isArray(narr.strengths) ? narr.strengths.length : 0;
  const scores = Array.isArray(p.scores) ? p.scores.length : 0;
  if (nSig) hasNarr++; else emptyNarr++;
  const c = byCompany.get(r.company_id) || { total: 0, empty: 0 };
  c.total++; if (!nSig) c.empty++;
  byCompany.set(r.company_id, c);
}
console.log(`narrative.hasSignal=true: ${hasNarr}   empty narrative: ${emptyNarr}`);

// 2) Per-company empty-rate + corpus sizes
console.log(`\n=== per-company empty-narrative rate + corpus size ===`);
const companyIds = [...byCompany.keys()];
const { data: comps } = await sb
  .from("companies")
  .select("id, name, ai_guidance_enabled")
  .in("id", companyIds);
const nameOf = new Map((comps || []).map((c) => [c.id, c]));

for (const cid of companyIds) {
  const stat = byCompany.get(cid);
  // latest corpus per kind
  const { data: corp } = await sb
    .from("sales_coach_corpus_versions")
    .select("kind, content, created_at")
    .eq("company_id", cid)
    .order("created_at", { ascending: false })
    .limit(20);
  const latest = {};
  for (const v of corp || []) if (!(v.kind in latest)) latest[v.kind] = (v.content || "").length;
  const meta = nameOf.get(cid) || {};
  console.log(
    `${meta.name || "?"} (${cid.slice(0, 8)}) guidance=${meta.ai_guidance_enabled} ` +
    `empty=${stat.empty}/${stat.total} corpus:${JSON.stringify(latest)}`
  );
}
process.exit(0);
