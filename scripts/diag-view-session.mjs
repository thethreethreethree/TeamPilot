#!/usr/bin/env node
// READ-ONLY diagnostic (§1.2) for "view session not showing 3 reps" (2026-08-27). NO writes.
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

const names = ["Alejandro", "Salazar", "Knute", "Knudtson", "Anthony"];
const { data: profs, error: pErr } = await sb
  .from("profiles")
  .select("id, full_name, company_id, role, sales_coach_role, removed_at")
  .or(names.map((n) => `full_name.ilike.%${n}%`).join(","));
if (pErr) { console.error("profiles:", pErr.message); process.exit(1); }
console.log("=== MATCHING PROFILES ===");
for (const p of profs ?? []) {
  console.log(`- ${p.full_name} | id=${p.id} | company=${p.company_id} | role=${p.role} | sc_role=${p.sales_coach_role} | removed_at=${p.removed_at}`);
}

const twoDaysAgo = new Date(Date.now() - 2 * 864e5).toISOString();
for (const p of profs ?? []) {
  const { data: sess } = await sb
    .from("coaching_sessions")
    .select("id, company_id, agent_id, status, started_at, audio_asset_url, recording_saved")
    .eq("agent_id", p.id)
    .order("started_at", { ascending: false })
    .limit(15);
  const total = (sess ?? []).length;
  const withAudio = (sess ?? []).filter((s) => s.audio_asset_url).length;
  const last2days = (sess ?? []).filter((s) => s.started_at >= twoDaysAgo).length;
  const compMismatch = (sess ?? []).filter((s) => s.company_id !== p.company_id).length;
  console.log(`\n=== SESSIONS for ${p.full_name} (agent_id=${p.id}) ===`);
  console.log(`  recent(≤15): ${total} | withAudio: ${withAudio} | in last 2 days: ${last2days} | company-mismatch: ${compMismatch}`);
  for (const s of (sess ?? []).slice(0, 6)) {
    console.log(`   · ${s.started_at} | status=${s.status} | audio=${s.audio_asset_url ? "yes" : "NO"} | saved=${s.recording_saved} | sess.company=${s.company_id}`);
  }
}

const companies = [...new Set((profs ?? []).map((p) => p.company_id).filter(Boolean))];
for (const c of companies) {
  const { count: nullAgent } = await sb
    .from("coaching_sessions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", c)
    .is("agent_id", null)
    .gte("started_at", twoDaysAgo);
  const { data: comp } = await sb.from("companies").select("id, name, access_module").eq("id", c).maybeSingle();
  console.log(`\n=== company ${c} (${comp?.name ?? "?"}, access_module=${comp?.access_module ?? "null"}): sessions w/ NULL agent_id in last 2 days: ${nullAgent ?? 0} ===`);
}
