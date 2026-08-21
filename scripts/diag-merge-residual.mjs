#!/usr/bin/env node
// READ-ONLY: orphaned rows whose company_id points at a merged-away (now-deleted) duplicate company. The
// 2026-08-21 merge moved coaching_sessions to canonical 28203036 and removed the duplicate company rows, but
// a failed pitch still references company fbeff8a9 — so DoorLog data (knocks/pitches) may have been left
// behind, orphaning it (brain-row lookup fails → "No brain row for company …"). NO writes.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.argv[2] || ".";
const env = Object.fromEntries(readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// All live company ids — anything referencing a company_id NOT in here is orphaned.
const { data: liveComps } = await sb.from("companies").select("id");
const live = new Set((liveComps ?? []).map((c) => c.id));
console.log(`live companies: ${live.size}`);

async function orphansIn(table) {
  // Page the distinct company_ids referenced by this table (bounded — these tables are small here).
  const seen = new Map();
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select("company_id").range(from, from + 999);
    if (error) { console.log(`  ${table}: query error ${error.message}`); return; }
    for (const r of data ?? []) seen.set(r.company_id, (seen.get(r.company_id) ?? 0) + 1);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  // A null company_id is "unassigned" (legitimate for profiles), NOT an orphan pointing at a dead company.
  const orphaned = [...seen.entries()].filter(([cid]) => cid && !live.has(cid));
  const total = orphaned.reduce((a, [, n]) => a + n, 0);
  console.log(`${table}: ${total} orphaned row(s) across ${orphaned.length} dead company_id(s)` + (orphaned.length ? ` → ${orphaned.map(([c, n]) => `${c.slice(0, 8)}:${n}`).join(", ")}` : ""));
}

for (const t of ["door_knocks", "pitches", "coaching_sessions", "profiles"]) await orphansIn(t);
