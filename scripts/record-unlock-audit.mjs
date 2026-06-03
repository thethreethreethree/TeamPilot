#!/usr/bin/env node
// One-off: records the audit row for the §3.4 control-window unlock that
// fired against company c3e7f389-..., since the canonical
// `record_brain_learning` RPC requires an auth session that REST calls
// don't carry. Direct insert into brain_evolution_events preserves the
// §7.5 review trail with the same structure.
//
// Safe to re-run: idempotency is informal (we accept that re-runs would
// duplicate audit rows), but the intent is run-once.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const body = {
  company_id: "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7",
  kind: "control_unlock",
  claim:
    "AI guidance unlocked manually (§3.4 control window overridden)",
  reasoning:
    "Dev override on 2026-06-03 to verify live-mode AI flows (Guide / Formulate / Summarize / Similar) end-to-end immediately after Supabase wiring. NOT for production. The §3.4 control window remains the constitutional default; this single override is preserved here for §7.5 review of whether early unlocks correlated with worse outcomes.",
  confidence: "low",
  recorded_by: "940ef40b-aae6-495d-9d66-93d037c41b7b",
};

const res = await fetch(`${SUPA_URL}/rest/v1/brain_evolution_events`, {
  method: "POST",
  headers: {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
try {
  const j = JSON.parse(text);
  if (Array.isArray(j) && j[0]) {
    console.log(`  audit row id:  ${j[0].id}`);
    console.log(`  kind:          ${j[0].kind}`);
    console.log(`  confidence:    ${j[0].confidence}`);
    console.log(`  claim:         ${j[0].claim}`);
    console.log(`  reasoning len: ${j[0].reasoning.length} chars`);
    console.log(`  recorded_at:   ${j[0].created_at}`);
  } else {
    console.log(text);
  }
} catch {
  console.log(text);
}
