// C.A.R.E AI-labor mix (read-only) — the metric that prices the "Managed C.A.R.E / save-15%" VA offer.
//
//   node scripts/care-labor-mix.mjs        (needs SUPABASE_DB_URL in .env.local — Session-pooler)
//
// Partitions every RESOLVED support_conversation into three human-labor tiers, from support_messages
// (author_type + co_pilot_invoked, migration 0040):
//
//   • fully_deflected  — zero author_type='agent' messages   → ~0 VA time (AI handled it end-to-end)
//   • copilot_assisted — agent messages exist, ALL AI-drafted (co_pilot_invoked) → reduced VA time
//   • fully_manual     — ≥1 agent message a human wrote unaided → full VA time
//
// The number that sizes the VA team is effective human-minutes/ticket across this mix, NOT a binary
// "deflection rate" — co-pilot is a second lever that shrinks the VA count even on tickets AI doesn't
// fully close. See the answer section in ELOSTATE-PRICING-ANALYSIS-Phase1-2 and
// memory project_va_managed_care_offer_2026_08_02.
//
// ONLY runs SELECT reads. Never writes. Exit 0 on success, 2 if it can't connect.
// HONESTY (§3.4): if the resolved-conversation count is small, the percentages are DIRECTIONAL ONLY —
// the tool prints the sample size and says so. Don't price the offer off a handful of tickets.

import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local — rely on ambient env */ }
}
loadEnv();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL not set (Session-pooler string). Cannot compute the labor mix.");
  process.exit(2);
}

// A resolved conversation is meaningful for this metric only if it's genuinely closed. We key on
// status='resolved' (the agent/AI-marked terminal state, stamped with resolved_at, 0034).
const SQL = `
  with resolved as (
    select id from support_conversations where status = 'resolved'
  ),
  per_conv as (
    select
      r.id,
      count(*) filter (where m.author_type = 'agent') as agent_msgs,
      count(*) filter (
        where m.author_type = 'agent' and coalesce(m.co_pilot_invoked, false) = false
      ) as manual_agent_msgs
    from resolved r
    left join support_messages m on m.conversation_id = r.id
    group by r.id
  )
  select
    count(*)::int                                                          as resolved_total,
    count(*) filter (where agent_msgs = 0)::int                            as fully_deflected,
    count(*) filter (where agent_msgs > 0 and manual_agent_msgs = 0)::int  as copilot_assisted,
    count(*) filter (where manual_agent_msgs > 0)::int                     as fully_manual
  from per_conv;
`;

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

function pct(n, total) {
  return total > 0 ? ((100 * n) / total).toFixed(1) + "%" : "—";
}

async function main() {
  await c.connect();
  const { rows } = await c.query(SQL);
  const r = rows[0];
  const total = r.resolved_total;

  console.log("\n═══ C.A.R.E AI-labor mix (read-only) ═══\n");
  if (total === 0) {
    console.log("  No resolved support conversations yet — nothing to measure.");
    console.log("  The metric becomes meaningful once C.A.R.E is in real use.\n");
    return;
  }
  const rows_out = [
    ["fully_deflected  (~0 VA time)", r.fully_deflected],
    ["copilot_assisted (reduced VA time)", r.copilot_assisted],
    ["fully_manual     (full VA time)", r.fully_manual],
  ];
  for (const [label, n] of rows_out) {
    console.log(`  ${label.padEnd(38)} ${String(n).padStart(6)}   ${pct(n, total)}`);
  }
  console.log(`  ${"".padEnd(38)} ${"".padStart(6)}`);
  console.log(`  resolved conversations (N)             ${String(total).padStart(6)}`);

  // §3.4 honesty: a small N makes the split noise, not signal. Say so, loudly.
  if (total < 200) {
    console.log(
      `\n  ⚠️  N=${total} is too small — treat these percentages as DIRECTIONAL ONLY, not a basis for pricing.`
    );
    console.log("     Re-run once C.A.R.E has real volume (a few hundred+ resolved tickets).");
  }
  console.log("");
}

main()
  .then(() => c.end())
  .catch((e) => {
    console.error("care-labor-mix failed:", e.message);
    c.end();
    process.exit(1);
  });
