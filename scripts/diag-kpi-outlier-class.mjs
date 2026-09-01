#!/usr/bin/env node
// READ-ONLY: hunt for the SAME class as the duration poison — an unbounded value that one outlier can use to
// corrupt a KPI average. Two suspects from compute.ts:
//   A) dealValue → revenue / avgDealSize (no upper plausibility bound; a mis-keyed deal spikes company revenue)
//   B) salesCycleLengthDays → avg cycle (a colliding/normalized client_label or stale first-contact = huge cycle)
// Reports whether each is LIVE (data exists to bite) or LATENT (no data yet). NO writes.
//   node scripts/diag-kpi-outlier-class.mjs   (repo root as $1 if not cwd-run)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[1] && !process.argv[1].endsWith(".mjs") ? process.argv[1] : (process.argv[2] || ".");
const env = Object.fromEntries(readFileSync(`${root}/.env.local`, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Pull all sessions with the fields the two metrics read.
const rows = [];
let from = 0;
for (;;) {
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("id, company_id, agent_id, outcome, deal_value, client_label, started_at")
    .order("started_at", { ascending: true })
    .range(from, from + 999);
  if (error) { console.error(error); process.exit(1); }
  rows.push(...(data ?? []));
  if (!data || data.length < 1000) break;
  from += 1000;
}
console.log(`\nsessions scanned: ${rows.length}`);

// ---- A) deal_value distribution ----
const withVal = rows.filter((r) => r.outcome === "sold" && r.deal_value != null);
console.log(`\n[A] sold sessions with a deal_value: ${withVal.length}  ${withVal.length === 0 ? "→ LATENT (metric can't be poisoned until values are entered)" : "→ LIVE"}`);
if (withVal.length) {
  const vals = withVal.map((r) => Number(r.deal_value)).sort((a, b) => a - b);
  const sum = vals.reduce((a, b) => a + b, 0);
  console.log(`    min ${vals[0]}  median ${vals[Math.floor(vals.length / 2)]}  max ${vals[vals.length - 1]}  mean ${(sum / vals.length).toFixed(2)}`);
  // outlier flag: any value > 20x the median is a mis-key suspect
  const med = vals[Math.floor(vals.length / 2)] || 1;
  const outliers = vals.filter((v) => v > med * 20);
  console.log(`    values > 20x median (mis-key suspects): ${outliers.length}${outliers.length ? "  " + outliers.join(", ") : ""}`);
}

// ---- B) prospect-label cycle: per (company, normalized label) sold, span first→sold ----
const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase().replace(/\s+/g, " ") : "");
const byKey = new Map();
for (const r of rows) {
  const k = norm(r.client_label);
  if (!k) continue;
  const kk = `${r.company_id}::${k}`;
  const e = byKey.get(kk) ?? { first: r.started_at, sold: null, n: 0 };
  if (r.started_at < e.first) e.first = r.started_at;
  if (r.outcome === "sold" && (e.sold === null || r.started_at < e.sold)) e.sold = r.started_at;
  e.n += 1;
  byKey.set(kk, e);
}
const cycles = [];
for (const [k, e] of byKey) {
  if (e.sold === null) continue;
  const days = (Date.parse(e.sold) - Date.parse(e.first)) / 86_400_000;
  if (Number.isFinite(days) && days >= 0) cycles.push({ k, days, n: e.n });
}
cycles.sort((a, b) => b.days - a.days);
console.log(`\n[B] labeled prospects with a sale (feed sales-cycle avg): ${cycles.length}  ${cycles.length === 0 ? "→ LATENT" : "→ LIVE"}`);
if (cycles.length) {
  const ds = cycles.map((c) => c.days);
  console.log(`    cycle days — min ${ds[ds.length - 1].toFixed(1)}  max ${ds[0].toFixed(1)}`);
  const big = cycles.filter((c) => c.days > 60);
  console.log(`    cycles > 60 days (collision / stale-first-contact suspects): ${big.length}`);
  big.slice(0, 5).forEach((c) => console.log(`      ${c.days.toFixed(1)}d  (${c.n} sessions)  key=${c.k.split("::")[1]}`));
}
