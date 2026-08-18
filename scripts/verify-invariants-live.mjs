// Live-DB invariant verifier (read-only) — re-confirms the structural invariants that were verified by hand on
// 2026-07-27 (see docs/audits/2026-07-27-live-db-verification.md). Complements `npm run invariant:audit`
// (static, scans code) with a check of the DEPLOYED database state. Run after a migration or before a release.
//
//   node scripts/verify-invariants-live.mjs        (needs SUPABASE_DB_URL in .env.local — Session-pooler)
//
// ONLY runs SELECT / catalog reads + one ROLLED-BACK write probe. Never commits a change. Exit 1 if any
// invariant FAILS (so CI can gate on it); exit 0 if all pass.

import { readFileSync } from "node:fs";
import pg from "pg";

// Minimal .env.local loader (avoids a dotenv dependency in a script).
function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env.local — rely on the ambient env */ }
}
loadEnv();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL not set (Session-pooler string). Cannot verify live invariants.");
  process.exit(2);
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "✓ PASS" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function has(query, params = []) {
  const r = await c.query(query, params);
  return r.rowCount > 0 ? r.rows[0] : null;
}

// Run one check in isolation: a thrown query (e.g. a table renamed by a future migration) becomes a clean
// FAIL for THAT check with the error, never a crash of the whole run — so the verifier still reports every
// other invariant and exits 1 (not an opaque exit 2). This matters because the tool is run right when schema
// changes (after a migration).
async function check(name, thunk) {
  try {
    const { pass, detail } = await thunk();
    record(name, pass, detail);
  } catch (e) {
    record(name, false, "CHECK ERRORED (treated as fail): " + String(e.message).slice(0, 80));
  }
}

async function main() {
  await c.connect();
  console.log("\n═══ Live-DB invariant verification (read-only) ═══\n");

  await check("§3.1 events append-only (no_delete + no_update rules)", async () => {
    const rDel = await has("select 1 from pg_rules where tablename='events' and rulename='events_no_delete'");
    const rUpd = await has("select 1 from pg_rules where tablename='events' and rulename='events_no_update'");
    return { pass: !!rDel && !!rUpd };
  });

  await check("§3.1 append-only registry — EVERY constitutional table retains its live enforcement (rule or trigger)", async () => {
    // docs/constitutional-db-invariants.md lists the FULL append-only set but is the "human-review defense" —
    // it explicitly names the gap: "until an order-aware invariant check is added, this registry is the
    // human-review defense". The `events` check above + the fin_* immutability checks guard a subset; this
    // closes the rest, so a migration that silently DROPs any member's rule/trigger FAILS CI instead of relying
    // on a reviewer noticing (the §5 "a protection gets dropped under pressure" risk, at the schema layer).
    // The enforcement MODEL varies (live-verified 2026-08-06) — encoded per table, NOT a blanket
    // no_update+no_delete, which would FALSE-FAIL the trigger-guarded members (chat_messages/support_messages/
    // resolutions freeze via a trigger; feedback/smoke_test_versions are no_delete-only by design).
    const ruleRows = await c.query(
      "select tablename, rulename from pg_rules where schemaname='public' and (rulename ilike '%no_update%' or rulename ilike '%no_delete%')");
    const R = new Set(ruleRows.rows.map((r) => `${r.tablename}.${/no_update/i.test(r.rulename) ? "U" : "D"}`));
    const trgRows = await c.query(
      "select cl.relname, tg.tgname from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid " +
      "join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and not tg.tgisinternal");
    const T = new Set(trgRows.rows.map((r) => `${r.relname}.${r.tgname}`));
    const hasU = (t) => R.has(`${t}.U`), hasD = (t) => R.has(`${t}.D`), hasT = (t, g) => T.has(`${t}.${g}`);
    const missing = [];
    // (a) Fully frozen — both no_update AND no_delete rules:
    for (const t of ["after_pitch_summaries", "brain_evolution_events", "care_widget_load_events",
      "coaching_cue_outcomes", "coaching_cues", "coaching_transcript_segments", "crm_activity_events",
      "decision_dialogues", "problem_signals", "sales_coach_corpus_versions", "signals", "smoke_test_results",
      "support_ai_co_pilot_edits", "support_conversation_events", "support_resolutions", "task_messages"]) {
      if (!hasU(t)) missing.push(`${t}: no_update rule DROPPED`);
      if (!hasD(t)) missing.push(`${t}: no_delete rule DROPPED`);
    }
    // (b) Trigger-guarded editables — no_delete rule + a guard/freeze trigger (edits allowed but guarded/
    //     event-sourced; do NOT "fix" into a no_update rule — it would break the feature):
    if (!hasD("chat_messages") || !hasT("chat_messages", "chat_messages_guard_edit_trg"))
      missing.push("chat_messages: no_delete rule + chat_messages_guard_edit_trg");
    if (!hasD("support_messages") || !hasT("support_messages", "trg_preserve_support_message_content"))
      missing.push("support_messages: no_delete rule + trg_preserve_support_message_content");
    if (!hasD("resolutions") || !hasT("resolutions", "resolutions_immutable"))
      missing.push("resolutions: no_delete rule + resolutions_immutable trigger");
    // (c) no_delete-only members (delete blocked; UPDATE permitted by design — feedback record / test infra):
    for (const t of ["feedback", "smoke_test_versions"]) if (!hasD(t)) missing.push(`${t}: no_delete rule DROPPED`);
    return {
      pass: missing.length === 0,
      detail: missing.length === 0
        ? "all 22 registry tables retain live append-only enforcement (per-table model)"
        : `DROPPED constitutional append-only enforcement:\n    ${missing.join("\n    ")}`,
    };
  });

  await check("§3.1 column-freeze + authz-column guard triggers WIRED (frozen columns immutable; no self-escalation)", async () => {
    // Two registry categories that were human-review-only: §3.1 column-freeze (a captured column can't be
    // rewritten after the fact) and the Security authz-column guards (a user can't self-escalate
    // role/company/agent-caps via a DIRECT column write — the A23 privilege-escalation class, the 2026-07-07
    // CRITICAL's sibling). A DROP of any lets the write through while npm run check stays green (§5 schema-layer
    // risk). Assert each is WIRED with the right timing/events (live-verified 2026-08-06). `resolutions_immutable`
    // is already asserted by the append-only registry check above — NOT re-checked here (no duplicate).
    const q = await c.query(
      "select cl.relname tbl, tg.tgname, tg.tgtype from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid " +
      "join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and not tg.tgisinternal");
    const m = {};
    for (const r of q.rows) m[`${r.tbl}.${r.tgname}`] = r.tgtype;
    const BEFORE = 2, INSERT = 4, UPDATE = 16; // tgtype bits
    const want = [
      // authz-column guards (privilege-escalation defense) — BEFORE, covering the write path:
      ["profiles", "profiles_guard_privileged", BEFORE | INSERT | UPDATE],
      ["chat_participants", "chat_participants_guard_privilege", BEFORE | INSERT | UPDATE],
      ["care_agent_state", "care_agent_state_guard_admin_cols", BEFORE | UPDATE],
      // §3.1 column-freeze — BEFORE UPDATE:
      ["chat_topic_decisions", "chat_topic_decisions_immutable", BEFORE | UPDATE],
      ["chat_topics", "chat_topics_immutable", BEFORE | UPDATE],
      ["team_invitations", "team_invitations_immutable", BEFORE | UPDATE],
      ["decision_dialogues", "decision_dialogues_immutable", BEFORE | UPDATE],
    ];
    const bad = [];
    for (const [tbl, name, bits] of want) {
      const t = m[`${tbl}.${name}`];
      if (t === undefined) bad.push(`${tbl}.${name}: MISSING (dropped)`);
      else if ((t & bits) !== bits) bad.push(`${tbl}.${name}: mis-wired (need timing/event bits ${bits}, got ${t})`);
    }
    return {
      pass: bad.length === 0,
      detail: bad.length === 0
        ? `all ${want.length} column-freeze + authz-guard triggers wired correctly`
        : `DROPPED / mis-wired constitutional guard trigger(s):\n    ${bad.join("\n    ")}`,
    };
  });

  await check("§3.2 understanding gate (raises + '*' threshold MEANINGFUL + trigger WIRED before insert-or-update)", async () => {
    const gateFn = await has(
      "select 1 from pg_proc where proname ilike '%understanding%' and pg_get_functiondef(oid) ilike '%raise exception%'");
    // The '*' default must EXIST *and* stay MEANINGFUL. A bare existence check passes even if the row's
    // min_signals were set to 0 — which silently DISABLES the gate (a problem surfaces with 0 signals),
    // defeating "understanding precedes solving" while every wiring check above still greens. Thesis floor:
    // >=2 signals from >=2 DISTINCT sources + a non-empty diagnosis. The founder may tune ABOVE this; a value
    // dropping BELOW it (a mis-migration or a manual edit) must FAIL the build, not slip through. Seeded
    // default is (3, 2, 80); thresholds are migration-only (no runtime mutation), so a migration is the risk.
    const star = await has(
      "select 1 from problem_thresholds where kind='*' " +
      "and min_signals >= 2 and min_distinct_sources >= 2 and min_diagnosis_chars >= 1");
    // The fn EXISTING is not enough — it must be WIRED. A trigger that is dropped (or narrowed to
    // UPDATE-only) silently lets a direct INSERT of a non-'draft' problem BYPASS the gate, while the
    // fn-exists check above still passes. Assert the trigger runs check_understanding_gate on `problems`,
    // BEFORE, on BOTH insert and update (tgtype bits: 2=BEFORE, 4=INSERT, 16=UPDATE). Empirically verified
    // 2026-07-31: an INSERT straight to status='open' with 0 signals raised "needs >=3, has 0".
    const trigWired = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='problems' and not tg.tgisinternal and p.proname='check_understanding_gate' " +
      "and (tg.tgtype & 2)=2 and (tg.tgtype & 4)=4 and (tg.tgtype & 16)=16");
    return { pass: !!gateFn && !!star && !!trigWired };
  });

  await check("H2 finance immutability (fin_entries_immutable + fin_lines_immutable fns + triggers WIRED)", async () => {
    const immEntry = await has("select 1 from pg_proc where proname='fin_entries_immutable'");
    const immLines = await has("select 1 from pg_proc where proname='fin_lines_immutable'");
    // Same fn-exists-is-not-enough lesson as §3.2 (2026-07-31): assert each immutability fn is WIRED as a
    // BEFORE UPDATE+DELETE trigger on its table (tgtype bits 2=BEFORE, 8=DELETE, 16=UPDATE). A dropped or
    // event-narrowed trigger would let a POSTED journal entry/line be silently mutated or deleted — the
    // money-integrity guarantee gone — while the fn-exists check above still passed green.
    const trigEntry = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='fin_journal_entries' and not tg.tgisinternal and p.proname='fin_entries_immutable' " +
      "and (tg.tgtype & 2)=2 and (tg.tgtype & 8)=8 and (tg.tgtype & 16)=16");
    const trigLines = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='fin_journal_lines' and not tg.tgisinternal and p.proname='fin_lines_immutable' " +
      "and (tg.tgtype & 2)=2 and (tg.tgtype & 8)=8 and (tg.tgtype & 16)=16");
    return { pass: !!immEntry && !!immLines && !!trigEntry && !!trigLines };
  });

  await check("H3 finance double-entry balance (fn raises + both balance triggers WIRED on the journal tables)", async () => {
    const bal = await has(
      "select 1 from pg_proc where proname='fin_assert_entry_balanced' and pg_get_functiondef(oid) ilike '%unbalanced%'");
    // fn-exists is not enough (the §3.2/H2 lesson, 2026-07-31): balance is enforced by two DEFERRABLE
    // CONSTRAINT triggers that fire at commit. If either were dropped, an UNBALANCED entry could post while
    // this check stayed green. Assert both are wired + fire on INSERT (tgtype bit 4=INSERT):
    // fin_assert_balanced_from_entry on fin_journal_entries (it calls the fin_assert_entry_balanced above)
    // and fin_assert_balanced on fin_journal_lines.
    const trigEntry = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='fin_journal_entries' and not tg.tgisinternal and p.proname='fin_assert_balanced_from_entry' " +
      "and (tg.tgtype & 4)=4");
    const trigLines = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='fin_journal_lines' and not tg.tgisinternal and p.proname='fin_assert_balanced' " +
      "and (tg.tgtype & 4)=4");
    return { pass: !!bal && !!trigEntry && !!trigLines };
  });

  await check("§3.4 no-instant-results — the coach-control-window trigger is WIRED (Month-1 baseline can't be silently skipped)", async () => {
    // §3.4 "honesty is the moat": enforce_coach_control_window RAISES if coach_enabled flips false→true during
    // a company's first-30-day control phase — so no customer gets instant AI guidance (which would claim
    // understanding the System can't yet have). It is TRIGGER-enforced; if the trigger were dropped (a
    // migration recreating companies triggers), the honesty moat would lapse SILENTLY while the fn still
    // exists. Assert the trigger is wired BEFORE UPDATE on companies (tgtype bits 2=BEFORE, 16=UPDATE) — the
    // same fn-checked-not-trigger discipline this session applied to §3.2 / H2 / H3.
    const wired = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='companies' and not tg.tgisinternal and p.proname='enforce_coach_control_window' " +
      "and (tg.tgtype & 2)=2 and (tg.tgtype & 16)=16");
    return { pass: !!wired, detail: wired ? "control-window trigger wired BEFORE UPDATE on companies" : "MISSING — §3.4 honesty moat can be silently bypassed" };
  });

  await check("§3.5 durability loop — the durability-review EMIT trigger is WIRED (a resolved-then-reviewed signal reaches the event chain)", async () => {
    // §3.5 measures whether a resolution HELD (the "did the fix stay fixed?" moat metric). When a
    // resolution's `durability` changes, resolutions_emit_durability_review inserts a
    // `resolution.durability_reviewed` event — that's how the §3.5 signal becomes visible (§3.6). It is an
    // EMIT trigger (not a raise): if dropped, durability reviews would SILENTLY stop reaching the event
    // chain — the moat metric vanishes while the fn still exists. Same fn-checked-not-trigger class as §3.4.
    // Assert BOTH durability-emit triggers are wired on UPDATE (tgtype bit 16=UPDATE): resolutions (0100) AND
    // its sibling chat_topics (0015 — the registry pairs them: "exactly the gap 0015 closed for chat topics").
    // Dropping EITHER silently severs one half of the §3.5 loop, so both are asserted.
    const resWired = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='resolutions' and not tg.tgisinternal and p.proname='resolutions_emit_durability_review' " +
      "and (tg.tgtype & 16)=16");
    const topicWired = await has(
      "select 1 from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid join pg_proc p on p.oid=tg.tgfoid " +
      "where cl.relname='chat_topics' and not tg.tgisinternal and p.proname='chat_topics_emit_durability_review' " +
      "and (tg.tgtype & 16)=16");
    const gaps = [];
    if (!resWired) gaps.push("resolutions_emit_durability_review");
    if (!topicWired) gaps.push("chat_topics_emit_durability_review");
    return {
      pass: gaps.length === 0,
      detail: gaps.length === 0
        ? "both durability-review emit triggers wired on UPDATE (resolutions + chat_topics)"
        : `MISSING — §3.5 durability signal would silently stop reaching the event chain: ${gaps.join(", ")}`,
    };
  });

  await check("no SECURITY DEFINER function lacks a pinned search_path (search_path-injection / privilege-escalation defense)", async () => {
    // A SECURITY DEFINER function runs with the OWNER's privileges. Without its OWN pinned search_path, a
    // caller can prepend a schema they control and make the elevated function resolve a MALICIOUS object (a
    // shadowed function/table) — a privilege-escalation vector that Supabase's own linter flags. This is the
    // LIVE, CI-integrated version of that lint, so a NEW definer fn added without `set search_path` fails the
    // build. Verified 2026-07-31: 115 DEFINER fns, 0 unpinned. Complements INVARIANT 4 (anon-callable DEFINER)
    // on the OTHER definer-risk axis (injection vs reachability).
    const r = await c.query(
      "select count(*)::int n, coalesce(string_agg(p.proname, ', '), '') fns from pg_proc p " +
      "join pg_namespace nsp on nsp.oid=p.pronamespace and nsp.nspname='public' " +
      "where p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'))");
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0 ? "all SECURITY DEFINER fns pin search_path" : `${n} DEFINER fn(s) with NO pinned search_path → escalation risk: ${r.rows[0].fns}` };
  });

  await check("H4 finance RLS on + policies company-scoped", async () => {
    const rls = await c.query(
      "select relname from pg_class where relname in ('fin_journal_entries','fin_journal_lines') and relrowsecurity");
    const pols = await c.query(
      "select count(*)::int n from pg_policies where tablename in ('fin_journal_entries','fin_journal_lines') and coalesce(qual,with_check) ilike '%auth_company_id()%'");
    return { pass: rls.rowCount === 2 && pols.rows[0].n >= 4, detail: `${rls.rowCount}/2 tables RLS, ${pols.rows[0].n} scoped policies` };
  });

  await check("no public VIEW bypasses RLS (every view is security_invoker on|true) — LIVE complement to rls:audit's migration-text parse", async () => {
    // A Postgres view runs as its OWNER (bypassing the caller's RLS) UNLESS security_invoker is set — then it
    // runs as the CALLER and the underlying tables' RLS applies. rls:audit parses the MIGRATION TEXT; this
    // checks the LIVE catalog, catching a DRIFT where a view lost the option live (e.g. a `create or replace
    // view` that omitted the clause, which resets it to owner-security) — the text can say safe while live
    // isn't. The predicate matches BOTH renderings: Postgres stores the boolean as `on`, migrations write
    // `true`. NB (2026-07-31): matching ONLY `true` is exactly the bug that produced a FALSE "14 views bypass
    // RLS" finding — a later behavioral `SET ROLE anon; SELECT` (→ 0 rows) proved every view RLS-safe. This
    // guard codifies the correct predicate so that mistake can't recur, and it fails if a real drift appears.
    const r = await c.query(
      "select count(*)::int n, coalesce(string_agg(cl.relname, ', '), '') tbls from pg_class cl " +
      "join pg_namespace ns on ns.oid=cl.relnamespace and ns.nspname='public' " +
      "where cl.relkind='v' and coalesce(array_to_string(cl.reloptions,','),'') !~* 'security_invoker=(on|true)'");
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0 ? "all public views are security_invoker (RLS applies as the caller)" : `${n} non-invoker view(s) → potential RLS bypass: ${r.rows[0].tbls}` };
  });

  await check("tenant isolation: every company_id table has RLS ON (no cross-tenant leak)", async () => {
    // The single highest-value tenant-isolation invariant: a table holding tenant data (a company_id column)
    // MUST have RLS enabled, or any authenticated user reads every tenant's rows. A future migration that adds
    // a tenant table and forgets `alter table … enable row level security` is a silent cross-tenant leak —
    // this catches it. (Verified 2026-07-27: 98 company_id tables, 0 with RLS off.)
    const r = await c.query(
      "select count(*)::int n, coalesce(string_agg(cl.relname, ', '), '') as tbls from pg_class cl join pg_namespace ns on ns.oid=cl.relnamespace and ns.nspname='public' where cl.relkind='r' and not cl.relrowsecurity and exists (select 1 from information_schema.columns col where col.table_name=cl.relname and col.column_name='company_id')");
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0 ? "all company_id tables RLS-protected" : `${n} table(s) with RLS OFF → LEAK: ${r.rows[0].tbls}` };
  });

  await check("tenant isolation: no company_id table has a PERMISSIVE read policy (RLS-on ≠ open)", async () => {
    // Complements the RLS-ON check above: a table can have RLS ENABLED yet a SELECT/ALL policy whose USING
    // clause is literally `true` (or null) — which permits EVERY row, so any authenticated user reads all
    // tenants. That passes the "RLS on" check while leaking exactly what RLS is supposed to stop. A debug
    // `using (true)` left in a migration, or an "enable RLS" without a real policy, is the shape. Flag any
    // company_id table with a permissive read policy. (The finance H4 check verifies the stronger property —
    // policies reference auth_company_id() — but only for the two ledger tables; this covers the rest.)
    const r = await c.query(
      "select count(distinct cl.relname)::int n, coalesce(string_agg(distinct cl.relname, ', '), '') as tbls " +
      "from pg_policies pol join pg_class cl on cl.relname = pol.tablename " +
      "join pg_namespace ns on ns.oid = cl.relnamespace and ns.nspname = 'public' " +
      "where pol.schemaname = 'public' and pol.cmd in ('SELECT','ALL') " +
      "and (pol.qual is null or btrim(lower(pol.qual)) in ('true','(true)')) " +
      "and exists (select 1 from information_schema.columns col where col.table_name = cl.relname and col.column_name = 'company_id')");
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0 ? "no company_id table has a permissive read policy" : `${n} table(s) with a PERMISSIVE read policy → LEAK: ${r.rows[0].tbls}` };
  });

  await check("tenant isolation BEHAVIORAL: ROLE anon reads 0 from POPULATED tenant tables (RLS actually enforces, not just ON)", async () => {
    // The structural checks above prove RLS is ON + no permissive read policy. This is the BEHAVIORAL proof —
    // the memory's lesson (reference_behavioral_verify_beats_catalog_string): a catalog string can read
    // `reloptions=on` while PG stored it differently, so the only real proof is `SET ROLE anon; SELECT` → 0.
    // Line ~185 notes that was done BY HAND once; this makes it a repeatable invariant. For each table we FIRST
    // confirm it is non-empty as the service role (so anon=0 means "RLS blocked", not "table empty"), THEN read
    // it as anon and require 0. Wrapped per-table in a transaction so `set local role` can never leak into a
    // later check. Verified 2026-08-05: anon read 0 of ELOSTATE's 121 coaching_sessions, etc.
    const tables = ["coaching_sessions", "support_messages", "events", "profiles", "companies"];
    const leaks = [];
    let proven = 0;
    for (const t of tables) {
      const total = (await c.query(`select count(*)::int n from ${t}`)).rows[0].n; // service role
      if (total === 0) continue; // empty → cannot prove RLS from it; skip
      await c.query("begin");
      try {
        await c.query("set local role anon");
        const anon = (await c.query(`select count(*)::int n from ${t}`)).rows[0].n;
        if (anon !== 0) leaks.push(`${t}: anon reads ${anon} of ${total}`);
        else proven++;
      } finally {
        await c.query("rollback"); // resets the role + any state
      }
    }
    return {
      pass: leaks.length === 0 && proven > 0,
      detail: leaks.length
        ? `CROSS-TENANT LEAK: ${leaks.join("; ")}`
        : proven > 0
          ? `anon reads 0 from ${proven} populated tenant tables (RLS behaviorally enforced)`
          : "no populated tenant table to prove against (inconclusive)",
    };
  });

  await check("auth-gate invariant: profiles.status CHECK is exactly (active, removed)", async () => {
    // The extension auth gate + requireCareAgent DENYLIST 'removed' (block it, allow the rest). That's only
    // safe because status can ONLY be 'active' or 'removed'. If a migration adds a status (e.g. 'suspended'),
    // BOTH gates silently FAIL OPEN (a suspended user is !== 'removed' → allowed). This locks the dependency:
    // if the constraint changes, this fails — flip both gates to an ALLOWLIST (status === 'active').
    const r = await c.query(
      "select pg_get_constraintdef(con.oid) as def from pg_constraint con join pg_class rel on rel.oid=con.conrelid where rel.relname='profiles' and con.contype='c' and pg_get_constraintdef(con.oid) ilike '%status%' limit 1");
    const def = (r.rows[0]?.def || "").replace(/\s+/g, " ").trim();
    const expected = "CHECK ((status = ANY (ARRAY['active'::text, 'removed'::text])))";
    return { pass: def === expected, detail: def === expected ? "denylist safe" : `CHANGED → flip extensionAuth + requireCareAgent to allowlist: ${def || "(no constraint found)"}` };
  });

  await check("finding-25 audio pointers all purgeable (0 non-'assets-v1/' shapes)", async () => {
    const badAudio = await c.query(
      "select count(*)::int n from coaching_sessions where audio_asset_url is not null and audio_asset_url not like 'assets-v1/%'");
    return { pass: badAudio.rows[0].n === 0, detail: `${badAudio.rows[0].n} bad` };
  });

  await check("finding-6a4 no posted entry dated outside its period (0 mis-dated)", async () => {
    const badDate = await c.query(`
      select count(*)::int n from fin_journal_entries je join fin_periods p on p.id = je.period_id
      where je.status='posted' and (je.entry_date < p.start_date or je.entry_date > p.end_date)`);
    return { pass: badDate.rows[0].n === 0, detail: `${badDate.rows[0].n} mis-dated` };
  });

  await check("RCD purge-enabled (content-immutable trigger, no delete-blocking rule)", async () => {
    // content-immutable via a trigger firing on UPDATE, but NOT delete-blocked (no `do instead nothing`
    // DELETE rule) — else the PII retention cron would silently no-op and retain data.
    const rcdImmut = await has(
      "select 1 from pg_trigger where tgrelid='care_rcd_conversations'::regclass and not tgisinternal and (tgtype & 16)=16");
    const rcdDelRule = await has(
      "select 1 from pg_rules where tablename='care_rcd_conversations' and definition ilike '%DO INSTEAD NOTHING%' and lower(definition) like '%on delete%'");
    return { pass: !!rcdImmut && !rcdDelRule, detail: rcdDelRule ? "a DELETE do-instead-nothing rule would BREAK the purge" : "delete path is open" };
  });

  await check("pilot redeem is NOT anon-executable (0198 grant fix holds)", async () => {
    // redeem_pilot_code creates a company + admin profile + provisions a module. It must run only as an
    // AUTHENTICATED caller (the just-signed-up user), never anon — Supabase auto-grants EXECUTE to anon on
    // public functions, so 0198 explicitly `revoke ... from anon`. This is a POINT-IN-TIME fix: a future
    // migration that `create or replace`s the function, or otherwise re-grants anon, would silently reopen
    // unauthenticated account creation with no CI signal. This locks it.
    //
    // Surgical on purpose: the SIBLING pilot_code_status(text) is INTENTIONALLY anon (non-consuming
    // validator the /redeem page calls before login), so a blanket "no anon DEFINER" rule would false-flag
    // it. We assert only the privileged mutation.
    const r = await c.query(`
      select p.prosecdef as definer,
             has_function_privilege('anon', p.oid, 'execute') as anon_exec,
             has_function_privilege('authenticated', p.oid, 'execute') as authed_exec
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='redeem_pilot_code'
        and pg_get_function_identity_arguments(p.oid) = 'p_code text, p_company_name text, p_full_name text'`);
    if (r.rowCount === 0) return { pass: false, detail: "redeem_pilot_code(text,text,text) NOT FOUND (pilot broken?)" };
    const { anon_exec, authed_exec } = r.rows[0];
    // anon must be revoked; authenticated must remain (else the redeem route can't call it at all).
    const pass = anon_exec === false && authed_exec === true;
    return {
      pass,
      detail: pass
        ? "anon revoked, authenticated retained"
        : `anon_exec=${anon_exec} (must be false), authed_exec=${authed_exec} (must be true)`,
    };
  });

  await check("tenant isolation: no company_id table has a PERMISSIVE WRITE policy (cross-tenant write)", async () => {
    // Write analog of the permissive-READ check: a permissive INSERT/UPDATE/ALL policy lets a user write into
    // ANOTHER tenant's rows. Subtlety — the effective write-check is coalesce(with_check, qual): Postgres uses
    // the USING (qual) expression as the check when with_check is null, so a policy with a null with_check but a
    // company-scoped qual is SAFE (verified 2026-07-31: 3 such ALL policies — care_tenant_config,
    // support_canned_responses, support_tags — inherit their scoped qual). Flag only when that EFFECTIVE check
    // is null/true. service_role policies are excluded (service-role writes are trusted, RLS-bypassing jobs).
    // Covers INSERT/UPDATE/DELETE/ALL. For DELETE (and UPDATE's row-visibility) with_check is null, so
    // coalesce(with_check, qual) correctly falls through to qual — a permissive DELETE (qual true) that
    // could remove another tenant's rows is caught too.
    const r = await c.query(
      "select count(*)::int n, coalesce(string_agg(distinct cl.relname, ', '), '') as tbls " +
      "from pg_policies pol join pg_class cl on cl.relname=pol.tablename " +
      "join pg_namespace ns on ns.oid=cl.relnamespace and ns.nspname='public' " +
      "where pol.schemaname='public' and pol.cmd in ('INSERT','UPDATE','DELETE','ALL') " +
      "and exists (select 1 from information_schema.columns col where col.table_name=cl.relname and col.column_name='company_id') " +
      "and btrim(lower(coalesce(pol.with_check, pol.qual, 'true'))) in ('true','(true)') " +
      "and not (pol.roles::text[] && array['service_role'])");
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0 ? "no company_id table has a permissive write policy" : `${n} table(s) with a PERMISSIVE write policy → cross-tenant write: ${r.rows[0].tbls}` };
  });

  await check("every finance company_id table has an affirmatively company-scoped read policy", async () => {
    // H4 above verifies the two LEDGER tables reference auth_company_id(); this extends that AFFIRMATIVE
    // property to ALL 54 fin_* company_id tables. The permissive-policy check catches `using(true)`, but a
    // SUBTLY under-scoped SELECT policy (e.g. scoped by a wrong column, or referencing another table without
    // the company match) is not literally `true` yet can still leak — so require every fin_ SELECT/ALL policy
    // to reference a company-scoping signal (auth_company_id() or company_id). A table with NO select policy
    // (deny-all) is fine — it has no unscoped policy to flag. Verified 2026-07-31: 0 unscoped across 54 tables.
    const r = await c.query(
      "select count(*)::int n, coalesce(string_agg(distinct cl.relname, ', '), '') as tbls " +
      "from pg_policies pol join pg_class cl on cl.relname = pol.tablename " +
      "join pg_namespace ns on ns.oid=cl.relnamespace and ns.nspname='public' " +
      "where pol.schemaname='public' and pol.tablename like 'fin_%' and pol.cmd in ('SELECT','ALL') " +
      "and exists (select 1 from information_schema.columns col where col.table_name=cl.relname and col.column_name='company_id') " +
      "and lower(coalesce(pol.qual,'')) not like '%auth_company_id%' and lower(coalesce(pol.qual,'')) not like '%company_id%'");
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0 ? "all fin_ company_id tables company-scoped (54 verified)" : `${n} finance SELECT policy(ies) NOT company-scoped → possible leak: ${r.rows[0].tbls}` };
  });

  await check("storage.objects has no anon/public or permissive read policy (private buckets stay private)", async () => {
    // Complements the bucket-`public` check: private buckets (assets-v1 user files, care-rcd-media customer
    // media) rely on storage.objects RLS — access only for `authenticated`, scoped to the caller's own company
    // path via auth_company_id(). The bucket-public check can't see this layer, so a future migration adding
    // an anon/public SELECT policy (world-readable via RLS) OR an authenticated policy with a permissive
    // `using (true)` (any tenant reads any object) would leak PII while the public-flag check stays green.
    // Verified 2026-07-31: the 6 policies are all authenticated + company-scoped; this locks that.
    const r = await c.query(
      "select coalesce(string_agg(policyname, ', '), '') as pols, count(*)::int n from pg_policies " +
      "where schemaname='storage' and tablename='objects' and cmd in ('SELECT','ALL') " +
      "and ((roles && array['anon','public']::name[]) or qual is null or btrim(lower(qual)) in ('true','(true)'))");
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0 ? "all storage.objects read policies are authenticated + scoped" : `${n} anon/public/permissive read policy(ies) → possible PII leak: ${r.rows[0].pols}` };
  });

  await check("Macro-Mode pitch tables keep the PER-REP owner restriction (peer-rep isolation — F8)", async () => {
    // Q4 = rep + manager: a rep sees only their OWN door-to-door pitches/knocks/analyses/summaries; a
    // same-company manager (role CEO/COO/admin or sales_coach_role='admin') sees the team. The tenant-pin
    // audits verify these are company-scoped — but a company-pin ALONE is satisfied by a COMPANY-WIDE policy:
    // one that dropped the `rep_id = auth.uid()` owner term would let any colleague read another rep's pitch
    // audio/transcript/analysis while every tenant-pin check stayed green. That widening is the F8 risk (audit
    // 2026-08-18, closure.md RQ-F8). The BEHAVIOURAL peer-rep test needs two real auth.users + a live pitch
    // (rep_id → auth.users, 0215:31; pitches empty until reps use the feature), so it stays a residual — but the
    // actual REGRESSION VECTOR is a policy edit, and that IS checkable against the live qual right here. The
    // owner term is `rep_id = auth.uid()` directly (door_knocks/pitches/rep_pattern_summaries) or
    // `pi.rep_id = auth.uid()` via the pitches subquery (pitch_transcripts/pitch_analyses) — both contain the
    // substring; the MANAGER clause uses `p.id = auth.uid()` (no `rep_id`), so dropping the owner term makes the
    // substring vanish → this fails. Verified 2026-08-18 against the live quals: all 5 carry it. A DROPPED
    // select policy (deny-all) is safe and correctly NOT flagged; only an EXISTING policy that lost the term.
    const tbls = ["door_knocks", "pitches", "pitch_transcripts", "pitch_analyses", "rep_pattern_summaries"];
    const r = await c.query(
      "select coalesce(string_agg(tablename || '.' || policyname, ', '), '') as pols, count(*)::int n " +
      "from pg_policies where schemaname='public' and tablename = any($1) and cmd in ('SELECT','ALL') " +
      "and lower(coalesce(qual,'')) not like '%rep_id = auth.uid()%'",
      [tbls]);
    const n = r.rows[0].n;
    return { pass: n === 0, detail: n === 0
      ? "all 5 Macro-Mode SELECT policies keep the rep-owner restriction (peer-rep isolation holds)"
      : `${n} Macro-Mode SELECT policy(ies) LOST the rep_id = auth.uid() owner term → peer-rep leak: ${r.rows[0].pols}` };
  });

  await check("pilot_codes RLS-sealed (deny-all: RLS on + 0 policies)", async () => {
    // pilot_codes holds LIVE single-use access keys — a leak lets an attacker read unredeemed codes and
    // create free accounts. Its security model is deny-all: RLS enabled with ZERO policies, so anon /
    // authenticated (PostgREST) get nothing; only the SECURITY DEFINER fns (redeem/status) and service_role
    // reach it. The table has `redeemed_company_id`, NOT `company_id`, so the tenant-RLS invariant above does
    // NOT cover it. This locks the seal: a future migration that disables RLS OR adds ANY policy (even a
    // restrictive read) is a design change to the access-key table and must fail CI for a human to review.
    const rls = await has("select 1 from pg_class where relname='pilot_codes' and relrowsecurity");
    const pol = await c.query("select count(*)::int n from pg_policies where tablename='pilot_codes'");
    const n = pol.rows[0].n;
    const pass = !!rls && n === 0;
    return {
      pass,
      detail: pass ? "RLS on, 0 policies (DEFINER/service-role only)"
        : `RLS ${rls ? "on" : "OFF"}, ${n} policy(ies) — access-key table must stay deny-all`,
    };
  });

  await check("no storage bucket is public except the intentional allowlist (PII-breach defense)", async () => {
    // A public bucket is world-readable by path with NO auth. care-rcd-media (customer conversation media)
    // and assets-v1 (user files) hold PII/sensitive data and MUST stay private — served only via short-TTL
    // signed URLs the app issues after an auth check. A future migration or console click flipping
    // public=true is a breach no code path would surface. Only widget-logos is intentionally public (tenant
    // branding shown on the customer widget). This asserts the whole class: any OTHER public bucket — an
    // existing one flipped, or a NEW bucket created public without review — fails. Add to the allowlist ONLY
    // with a deliberate "this holds no private data" decision.
    const PUBLIC_ALLOWLIST = new Set(["widget-logos"]);
    const r = await c.query("select id from storage.buckets where public = true");
    const unexpected = r.rows.map((x) => x.id).filter((id) => !PUBLIC_ALLOWLIST.has(id));
    return {
      pass: unexpected.length === 0,
      detail: unexpected.length === 0
        ? "only the allowlisted branding bucket is public"
        : `UNEXPECTED public bucket(s): ${unexpected.join(", ")} — world-readable, possible PII breach`,
    };
  });

  await check("§3.1 event UPDATE is a no-op (behavioral, rolled back)", async () => {
    // Wrapped in its own transaction so nothing persists; the finally guarantees the rollback even on error.
    await c.query("begin");
    try {
      const one = await c.query("select id, created_at from events limit 1");
      if (!one.rowCount) return { pass: true, detail: "no events to probe" };
      await c.query("update events set created_at = now() where id = $1", [one.rows[0].id]);
      const chk = await c.query("select created_at from events where id=$1", [one.rows[0].id]);
      const noop = chk.rows[0].created_at.getTime() === one.rows[0].created_at.getTime();
      return { pass: noop, detail: noop ? "UPDATE was a no-op" : "UPDATE CHANGED the row (append-only BROKEN)" };
    } catch (e) {
      // A raised exception is ALSO a valid append-only outcome (the write was refused).
      return { pass: true, detail: "UPDATE rejected: " + String(e.message).slice(0, 40) };
    } finally {
      await c.query("rollback").catch(() => {});
    }
  });

  await check("module hard-lock: every single-module redeemed company has the matching access_module (0207)", async () => {
    // The hard-lock only enforces if companies.access_module is set. The redeem_pilot_code RPC (0207) stamps
    // it from the code's module. If a future RPC edit silently stops stamping it, new single-module accounts
    // would provision UNLOCKED (full hub access) — the feature would erode invisibly. This asserts the write
    // path held: every care/sales_coach code already redeemed maps to a company locked to that module.
    const r = await c.query(
      `select count(*)::int as mismatched,
              coalesce(string_agg(distinct pc.module || '→' || coalesce(co.access_module,'null'), ', '), '') as detail
         from pilot_codes pc
         join companies co on co.id = pc.redeemed_company_id
        where pc.redeemed_company_id is not null
          and pc.module in ('care','sales_coach')
          and coalesce(co.access_module,'') <> pc.module`
    );
    const n = r.rows[0].mismatched;
    return {
      pass: n === 0,
      detail: n === 0
        ? "every single-module redeemed company is access_module-locked to its module"
        : `${n} redeemed single-module company(ies) NOT locked (redeem RPC regression?): ${r.rows[0].detail}`,
    };
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length === 0 ? "✅ ALL " + results.length + " invariants hold." : "❌ " + failed.length + " of " + results.length + " FAILED."}\n`);
  await c.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("verifier error:", e.message);
  try { await c.end(); } catch { /* ignore */ }
  process.exit(2);
});
