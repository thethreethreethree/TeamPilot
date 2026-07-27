#!/usr/bin/env node
//
// scripts/pilot-status.mjs — at-a-glance pilot access-code status (READ-ONLY).
//
// Run `npm run pilot:status` during a pilot launch to see, without opening the DB:
//   • inventory per module (total / used / unused)
//   • every redemption so far (code, module, email, company, when)
//
// Read-only: SELECTs only, never writes. Uses the same Session-pooler SUPABASE_DB_URL
// (.env.local) that db-apply / verify:live use.

import { readFileSync } from "node:fs";
import pg from "pg";

function loadConn() {
  const env = readFileSync(".env.local", "utf8");
  const m = env.match(/^SUPABASE_DB_URL=(.*)$/m);
  if (!m) {
    console.error("SUPABASE_DB_URL not found in .env.local");
    process.exit(1);
  }
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const client = new pg.Client({ connectionString: loadConn(), ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
} catch (err) {
  console.error(
    "\nCouldn't connect to the database. Check that SUPABASE_DB_URL in .env.local is the " +
      "Session-pooler string and that you have network access.\n  " +
      (err instanceof Error ? err.message : String(err))
  );
  process.exit(1);
}
try {
  const inv = (
    await client.query(`
    select module,
           count(*)                                   as total,
           count(*) filter (where redeemed_at is not null) as used,
           count(*) filter (where redeemed_at is null)     as unused
    from pilot_codes
    group by module
    order by module`)
  ).rows;

  console.log("\n═══ Pilot access codes — inventory ═══");
  if (inv.length === 0) {
    console.log("  (no pilot_codes seeded — did the seed run?)");
  } else {
    console.table(inv);
    const totals = inv.reduce(
      (a, r) => ({ total: a.total + +r.total, used: a.used + +r.used, unused: a.unused + +r.unused }),
      { total: 0, used: 0, unused: 0 }
    );
    console.log(`  TOTAL: ${totals.total} codes · ${totals.used} redeemed · ${totals.unused} available`);
  }

  const redemptions = (
    await client.query(`
    select pc.code,
           pc.module,
           pc.redeemed_by_email                     as email,
           c.name                                    as company,
           to_char(pc.redeemed_at, 'YYYY-MM-DD HH24:MI') as redeemed_at
    from pilot_codes pc
    left join companies c on c.id = pc.redeemed_company_id
    where pc.redeemed_at is not null
    order by pc.redeemed_at desc`)
  ).rows;

  console.log("\n═══ Redemptions ═══");
  if (redemptions.length === 0) {
    console.log("  (none yet — no codes redeemed)");
  } else {
    console.table(redemptions);
  }
  console.log("");
} catch (err) {
  console.error(
    "\nQuery failed. Is the pilot_codes table applied (migration 0197)?\n  " +
      (err instanceof Error ? err.message : String(err))
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
