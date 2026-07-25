#!/usr/bin/env node
//
// scripts/rls-audit.mjs — RLS policy completeness audit.
//
// What it does
// ────────────
// Statically parses supabase/migrations/*.sql to build a map of:
//   - which tables have RLS enabled,
//   - which policies (per operation) have been declared against each table,
// then asserts that every RLS-enabled table has policies covering the
// operations it actually needs. Missing operations are surfaced as
// findings.
//
// Why it exists
// ─────────────
// Postgres RLS is opt-in PER OPERATION. If you `alter table X enable row
// level security` but only write a `select` policy, then INSERT/UPDATE/
// DELETE are silently denied for non-service-role callers — and DELETE
// has a particularly nasty failure mode: it returns success with 0
// rows affected, leaving the caller convinced the row is gone when it
// is still there. This bit us in the user-visible pin/unpin loop and
// in the cascade chain when deleting test companies.
//
// The §1.7 audit caught these one at a time. This script makes the
// whole class of bug impossible to ship: it must either declare a
// policy for the operation OR explicitly allowlist the omission with a
// reason. Same shape as the theme-audit script's discipline.
//
// Allowlist
// ─────────
// Some tables INTENTIONALLY omit operations because the constitution
// requires it. Most notably the §3.1 append-only chain (events,
// signals, chat_messages, decision_dialogues, resolutions): no row
// should ever be updated or deleted by application code; they are
// historical record. The allowlist documents which omissions are
// intentional and WHY.
//
// Anything not in the allowlist and not policy-covered is a finding.
//
// Usage
// ─────
//   node scripts/rls-audit.mjs               # report, exit 1 if findings
//   node scripts/rls-audit.mjs --verbose     # also list per-table policies

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const VERBOSE = process.argv.includes("--verbose");

// Default is the real migrations dir; RLS_AUDIT_DIR lets the regression test point the same
// analysis at a fixture directory without duplicating the logic. Backward-compatible: unset
// in every real run (CI, `npm run rls:audit`), so production behavior is unchanged.
const MIGRATIONS_DIR = process.env.RLS_AUDIT_DIR || "supabase/migrations";
const OPS = ["select", "insert", "update", "delete"];

// ─── Intentional omissions allowlist ──────────────────────────────────
//
// Each entry: table.operation → reason. The reason MUST be a concrete
// constitutional or design statement, not "we don't think we need it".
// "We don't think we need it" means we haven't decided; either decide
// and add a policy, or decide and add an allowlist entry. The audit
// refuses ambiguous omissions.

const ALLOWLIST = new Map([
  // §3.1 append-only chain — events, signals, brain_evolution_events
  // are HISTORICAL RECORD. They are written by the system (triggers,
  // RPCs) and read by analysis paths; they are never updated or
  // deleted by application code. The cascade DELETE that arrives when
  // the parent company is removed is handled by FK cascades, which
  // bypass policy checks at the SQL-level (Postgres routes cascades
  // through table owner).
  // 0172 scheduled-report delivery log. The ABSENCE of these three policies is the control, not an
  // oversight — which is exactly the kind of deliberate gap this allowlist exists to distinguish from a
  // careless one.
  //   insert: only the DEFINER RPC (fin_record_report_delivery) writes here. A client that could insert
  //           could forge a 'sent' for a delivery that never happened.
  //   update/delete: append-only via `do instead nothing` RULES, which bind the SERVICE ROLE too — so the
  //           delivery worker cannot erase a failure it caused. A delivery that silently stops is worse
  //           than one that never existed: the recipient believes no news is good news.
  // 0180 inventory. Each absence is a control, not an oversight.
  //   items.delete: an item with movement history is the ONLY record of what was received and sold. Deleting
  //     it would erase the audit trail of stock that physically existed — deactivate (is_active) instead.
  //   movements.*: written by the DEFINER RPCs only, and append-only via RULES (which bind the service role
  //     too). A client that could INSERT could forge a receipt and manufacture inventory value out of
  //     nothing; one that could UPDATE or DELETE could erase a theft. The movement log IS the inventory's
  //     audit trail — a system that can rewrite it can hide a shortfall.
  ["fin_inventory_items.delete", "0180 an item with movements is the record of stock that existed; deactivate, never delete."],
  ["fin_inventory_movements.insert", "0180 DEFINER RPCs only — a client insert could forge a receipt and manufacture inventory value."],
  ["fin_inventory_movements.update", "0180 append-only (RULE) — a rewritable movement log can hide a theft."],
  ["fin_inventory_movements.delete", "0180 append-only (RULE) — deleting a movement erases the evidence of a shortfall."],

  ["fin_report_deliveries.insert", "0172 write path is the DEFINER RPC only; a client insert could forge a 'sent'."],
  ["fin_report_deliveries.update", "0172 append-only (RULE) — a run either happened or it did not."],
  ["fin_report_deliveries.delete", "0172 append-only (RULE) — the worker must not erase a failure it caused."],

  // 0192 care_visitor_presence — ephemeral anonymous visitor presence for the C.A.R.E Live Monitor. RLS
  // is ENABLED with NO policies BY DESIGN: every access is via the service-role client (touchVisitorPresence
  // writes, fetchLiveVisitors reads/purges — src/lib/data/care.ts), which bypasses RLS; tenant isolation is
  // enforced in code by company_id. Denying all direct authed/anon access is defense-in-depth for a table
  // that never needs direct end-user access (A23). Not §3.1 domain data — transient operational state, same
  // class as care_agent_state. (The absence of policies is the control, not an oversight.)
  ["care_visitor_presence.select", "0192 service-role-only Live Monitor read; tenant-scoped in code by company_id."],
  ["care_visitor_presence.insert", "0192 service-role-only widget presence write; row carries company_id."],
  ["care_visitor_presence.update", "0192 service-role-only upsert (onConflict company_id,visitor_id)."],
  ["care_visitor_presence.delete", "0192 service-role-only opportunistic purge of stale rows; scoped by company_id."],

  ["events.update", "§3.1 events are immutable historical record."],
  ["events.delete", "§3.1 events are immutable; cascades via FK only."],
  ["signals.update", "§3.1 signals are immutable derived facts."],
  // signals.delete — DROPPED from allowlist intentionally. The cascade
  // from companies → signals must be permitted at policy-level too on
  // Supabase, because the cascade runs under the calling auth context
  // when invoked via PostgREST. Added via migration 0017.

  // §3.1 chat — messages are append-only; only kind/system rows are
  // ever inserted by triggers, never updated. Pin-on-message updates
  // the pin row, not the message.
  [
    "chat_messages.update",
    "§3.1 messages are append-only; edits are out of scope.",
  ],
  [
    "chat_messages.delete",
    "§3.1 messages are immutable; soft-delete via topic close instead.",
  ],

  // Decision dialogues + resolutions — same §3.1 principle. The
  // dialogues record HOW a decision was made; the resolution records
  // the outcome and whether it held.
  ["decision_dialogues.update", "§3.1 decision dialogues are append-only."],
  ["decision_dialogues.delete", "§3.1 decision dialogues are append-only."],

  // 0193 care_knowledge_documents (ACMS) — per-tenant client-uploaded KNOWLEDGE, append-only by
  // design (§3.1). "Current knowledge" = the latest version per company; a business turns knowledge
  // off by APPENDING a status='retracted' version, never by editing or deleting a row. The absence of
  // UPDATE/DELETE policies is the control (end users cannot mutate the record), backed defense-in-depth
  // by the check_care_knowledge_immutability trigger (0193) which freezes the content columns while
  // permitting created_by->NULL so GDPR user-erasure is never blocked. Same class as events/signals.
  ["care_knowledge_documents.update", "§3.1 0193 ACMS knowledge is append-only — retract = append a new version, never edit."],
  ["care_knowledge_documents.delete", "§3.1 0193 ACMS knowledge is immutable record; retract via a status='retracted' version, never delete."],
  // resolutions.update is NOT append-only: the 0005 "resolutions - all" for-all policy
  // (company-scoped) covers it, and the resolution REVIEW legitimately edits
  // observed_outcome/durability/reviewed_at (see /api/resolutions PATCH). It's listed
  // here only because this audit's parser doesn't expand `for all` to per-op coverage.
  // DELETE, by contrast, is genuinely blocked (0094 no-delete rule).
  ["resolutions.update", "Covered by the 0005 'resolutions - all' for-all policy; the resolution review legitimately updates observed_outcome/durability/reviewed_at (company-scoped). Not append-only for update — only delete is blocked (0094)."],
  ["resolutions.delete", "§3.1 resolutions are append-only for DELETE — blocked by the 0094 no-delete rule (do-instead-nothing)."],
  // Saved "Dissect a Conversation" topics (0097). Append-only by design: Close keeps a
  // saved topic, only an unsaved thread is discarded client-side; editing/removing a
  // saved dissection is out of scope for v1 (0097's own comment). Owner-only select +
  // insert exist; no update/delete policy = deny, which is the intended posture.
  ["dissect_topics.update", "§3.1 saved dissections are append-only (0097): editing is out of scope for v1 by design."],
  ["dissect_topics.delete", "§3.1 saved dissections are append-only (0097): Close keeps a saved topic; only an unsaved thread is discarded client-side."],

  // Brain evolution events — §3.4/§7.5 audit trail.
  [
    "brain_evolution_events.update",
    "§7.5 brain evolution is immutable so distrust-of-evolution can review.",
  ],
  [
    "brain_evolution_events.delete",
    "§7.5 brain evolution is immutable so distrust-of-evolution can review.",
  ],

  // problem_signals — link table between problems and signals,
  // immutable evidence-of-evidence.
  ["problem_signals.update", "Link table; updates would falsify evidence trail."],
  ["problem_signals.delete", "Link table; deletes would falsify evidence trail."],

  // Reference data (signal_sources, problem_thresholds) — system
  // configuration, only mutable by ops via service-role.
  ["signal_sources.insert", "System-config table; only ops/service-role writes."],
  ["signal_sources.update", "System-config table; only ops/service-role writes."],
  ["signal_sources.delete", "System-config table; only ops/service-role writes."],
  ["problem_thresholds.insert", "System-config table; only ops/service-role writes."],
  ["problem_thresholds.update", "System-config table; only ops/service-role writes."],
  ["problem_thresholds.delete", "System-config table; only ops/service-role writes."],

  // chat_participants — uses soft-delete via left_at, not row deletion.
  [
    "chat_participants.delete",
    "Soft-delete via left_at column; hard delete would lose audit trail.",
  ],

  // chat_topics — topics are not deleted by users; closing via the
  // close_topic RPC is the lifecycle end-state.
  ["chat_topics.delete", "Topics close via RPC, never delete (§3.1)."],

  // Tenant lifecycle — companies and profiles are deleted at the ops
  // level (account closure, GDPR right-to-be-forgotten) via direct
  // service-role access, not via PostgREST. Exposing a user-callable
  // DELETE policy would let a malicious admin nuke the tenant from a
  // browser bug.
  [
    "companies.delete",
    "Tenant deletion is an ops action; service-role only via direct DB access. No user-facing policy.",
  ],
  [
    "profiles.delete",
    "Profile is the auth-user-to-company link. Deletion happens via cascade from auth.users (account closure), not via direct delete.",
  ],

  // Feedback (0018) — append-only per §3.1. Status updates are
  // permitted (the trigger emits a feedback.status_changed event on
  // each transition); rows are never deleted. The §1.1 'data-as-
  // asset' rule applies — even rejected/declined feedback is
  // preserved as part of the record.
  [
    "feedback.delete",
    "§3.1 append-only. Feedback is permanent record; declined/duplicate marked via status, never deleted.",
  ],
  [
    "smoke_test_versions.delete",
    "§3.1 append-only. New checklist edits create new versions; old versions remain referenceable from prior results.",
  ],
  [
    "smoke_test_results.update",
    "§3.1 append-only. A re-test by the same tester appends a new row, preserving the journey of fail → fix → pass.",
  ],
  [
    "smoke_test_results.delete",
    "§3.1 append-only. Test results are permanent measurement record.",
  ],
  [
    "task_messages.update",
    "§3.1 append-only. The task thread is the record — no edits, no deletes.",
  ],
  [
    "task_messages.delete",
    "§3.1 append-only. The task thread is the record — no edits, no deletes.",
  ],
  [
    "task_participants.delete",
    "Participants leave a task by setting left_at, never by deletion. Engagement history (last_engaged_at, engagement_count) is constitutional record per A10 transparency.",
  ],
  [
    "chat_topic_decisions.delete",
    "§A1 data-as-asset. An opened-by-mistake in-thread dialogue is resolved as chosen_path='defer', never deleted — the constitutional meaning of 'not enough understanding yet' is exactly this record.",
  ],

  // ─── Live Sales Coach (0070/0079/0080) — §3.1 append-only ─────────────
  // The coaching event chain mirrors the core events chain: a call's
  // transcript, cues, outcomes and summary are an immutable record so the
  // post-call review + retrospective analysis (§1.2) are trustworthy.
  [
    "coaching_sessions.delete",
    "§3.1 a coaching session is a permanent record — ended/archived via status, never deleted.",
  ],
  [
    "coaching_transcript_segments.update",
    "§3.1 append-only. The diarized transcript is the record; corrections append (e.g. one-tap re-label), never edit.",
  ],
  [
    "coaching_transcript_segments.delete",
    "§3.1 append-only. Transcript segments are permanent; a call's record is not erased.",
  ],
  [
    "coaching_cues.update",
    "§3.1 append-only. Each cue is an immutable event; rep-marked 'used' appends a new signal, never edits the cue.",
  ],
  [
    "coaching_cues.delete",
    "§3.1 append-only. Cues are the permanent record of what the coach said, when.",
  ],
  [
    "coaching_cue_outcomes.update",
    "§3.1 append-only (0079). A cue's outcome/trigger is measured record — §3.5 measures consequence, never edits it.",
  ],
  [
    "coaching_cue_outcomes.delete",
    "§3.1 append-only. Cue-outcome rows are permanent measurement record.",
  ],
  [
    "sales_coach_corpus_versions.update",
    "§3.1 append-only. A new methodology/product corpus edit appends a new VERSION; old versions remain referenceable (same shape as smoke_test_checklists).",
  ],
  [
    "sales_coach_corpus_versions.delete",
    "§3.1 append-only. Corpus versions are the audit trail of how the team's methodology evolved.",
  ],
  [
    "after_pitch_summaries.update",
    "§3.1 append-only — 0080 enforces this with a do-instead-nothing rule; a re-run appends a new summary row.",
  ],
  [
    "after_pitch_summaries.delete",
    "§3.1 append-only. After-pitch summaries are permanent growth record.",
  ],

  // ─── C.A.R.E support chain (0034–0038, 0042) — §3.1 append-only ───────
  // DB-ENFORCED append-only: 0034/0035/0036 install do-instead-nothing rules
  // on support_messages / support_conversation_events / support_resolutions /
  // support_ai_co_pilot_edits. Widget-side rows are written by the SERVICE-ROLE
  // server (the widget never holds a JWT), so the missing insert policies are
  // intentional — anon has no direct write path. A missing policy is deny-all,
  // never over-permissive.
  [
    "support_customers.delete",
    "§3.1 a customer record is permanent; widget-created via service-role, never deleted.",
  ],
  [
    "support_conversations.insert",
    "Created by the widget via the SERVICE-ROLE server (0034) — no anon/user-client insert path.",
  ],
  [
    "support_conversations.delete",
    "§3.1 a conversation is a permanent record — closed via status, never deleted.",
  ],
  [
    "support_messages.update",
    "§3.1 append-only (0034 do-instead-nothing); the coach_grade refinement (0037) is server-side/service-role only.",
  ],
  [
    "support_messages.delete",
    "§3.1 append-only — 0034 blocks deletes with a do-instead-nothing rule.",
  ],
  [
    "support_conversation_events.insert",
    "Append-only audit log written by triggers + the service-role server (0035) — no user-client insert.",
  ],
  [
    "support_conversation_events.update",
    "§3.1 append-only — 0035 do-instead-nothing rule.",
  ],
  [
    "support_conversation_events.delete",
    "§3.1 append-only — 0035 do-instead-nothing rule.",
  ],
  [
    "support_resolutions.update",
    "§3.1 append-only — 0036 do-instead-nothing; a correction is a NEW capture, never an edit.",
  ],
  [
    "support_resolutions.delete",
    "§3.1 append-only — 0036 do-instead-nothing rule.",
  ],
  [
    "support_durability_checks.insert",
    "Scheduled + recorded server-side via service-role (0036 trigger) — no user-client insert.",
  ],
  [
    "support_durability_checks.delete",
    "§3.1 append-only. A durability re-check is a permanent measurement record.",
  ],
  [
    "support_ai_co_pilot_edits.update",
    "§3.1 append-only — 0036 do-instead-nothing rule.",
  ],
  [
    "support_ai_co_pilot_edits.delete",
    "§3.1 append-only — 0036 do-instead-nothing rule.",
  ],
  [
    "care_widget_load_events.insert",
    "Widget-bootstrap telemetry logged server-side via service-role (0038) — no user-client insert.",
  ],
  [
    "care_widget_load_events.update",
    "§3.1 append-only telemetry — a load event is immutable once recorded.",
  ],
  [
    "care_widget_load_events.delete",
    "§3.1 append-only telemetry.",
  ],
  [
    "care_agent_state.delete",
    "Presence/capacity is UPSERTED (0042) — set to offline, never deleted; the row IS the agent's current state.",
  ],

  // ─── CRM (0049) — §3.1 append-only events + soft-archive ──────────────
  [
    "crm_accounts.delete",
    "§3.1 soft-archive via status='archived' (0049) — accounts are never hard-deleted.",
  ],
  [
    "crm_activity_events.insert",
    "Append-only activity events written server-side via service-role (0049) — every state change is an immutable event.",
  ],
  [
    "crm_activity_events.update",
    "§3.1 append-only — activity events are immutable (0049).",
  ],
  [
    "crm_activity_events.delete",
    "§3.1 append-only — activity events are immutable (0049).",
  ],

  // ─── Departments + Files (0055, 0056) — soft-archive / soft-delete ────
  [
    "departments.delete",
    "§3.1 soft-archive — 0055 explicitly 'NEVER delete a department; archive' (archived_at).",
  ],
  [
    "profile_departments.update",
    "Pure membership join table (0055) — a profile joins/leaves via insert/delete; there is no updatable column.",
  ],
  [
    "files.delete",
    "§3.1 soft-delete via deprecated_at — 0056 files_preserve_immutable; a file asset is never hard-deleted.",
  ],

  // ─── Finance ledger/subledger/config (0116–0153) — §3.1 append-only + DEFINER-write ───
  // These tables carry NO direct insert/update/delete RLS policy BY DESIGN. Every write goes
  // through a SECURITY DEFINER posting/settlement/close function (fin_post_system_entry and the
  // AP/AR/expense/banking/year-close RPCs), which runs as table owner and BYPASSES RLS. The
  // client is deliberately given a SELECT-only surface: a direct write policy on the ledger would
  // BREAK the controlled-write model (you must post through the guarded function — you can never
  // insert a raw journal/payment/receipt row, or edit a posted one, from the client).
  // Verified 2026-07-13 (ground-up audit): no src/ code inserts/updates/deletes any of these
  // tables directly; all mutations are RPC → DEFINER. Config tables use a status/is_active
  // lifecycle, never hard-delete, so historical postings keep resolving their dimension.

  // Gap-free entry-numbering counter (0118) — internal machinery of the posting functions.
  ["fin_entry_counters.insert", "Incremented atomically inside the DEFINER posting functions (0118/0122) — no client write path; a direct policy would let a client skip/reuse entry numbers, breaking gap-free numbering."],
  ["fin_entry_counters.update", "The next-entry-no is claimed only by the DEFINER posting functions — a client update would corrupt gap-free sequential numbering."],
  ["fin_entry_counters.delete", "§3.1 the counter is permanent per-company machinery — deleting it would reset/duplicate entry numbers."],

  // Approval delegation (0168) — a privilege-granting row; revocation is deliberately RPC-only.
  ["fin_approval_delegations.update", "There is intentionally NO update path. A delegation is revoked through fin_revoke_delegation (which checks that the caller is the delegator, or a controller/CFO) — it is never edited. An UPDATE policy would let someone silently EXTEND a delegation's window, quietly restoring approval authority that was supposed to have lapsed, with an audit trail that shows nothing happened. Revoke-and-reissue is the honest path and leaves both events on the record."],

  // Posted depreciation slices (0166) — history, not a worklist row.
  ["fin_depreciation_entries.insert", "Written ONLY by the DEFINER RPC fin_run_depreciation (0166), which locks the asset, clamps the slice to the remaining depreciable base (so net book value can never fall below salvage), and posts the balanced Dr Depreciation / Cr Accumulated entry. A direct client insert would bypass the salvage clamp and the (asset, period) unique — the two things that stop the books claiming an asset is worth less than scrap, or depreciating it twice."],
  ["fin_depreciation_entries.update", "§3.1 append-only — a `do instead nothing` RULE blocks UPDATE (rules bind service-role and direct SQL too). A posted depreciation slice is history; it is corrected by a reversing entry, never by editing the record of what was posted."],
  ["fin_depreciation_entries.delete", "§3.1 append-only — `do instead nothing` RULE blocks DELETE. Deleting a slice would silently understate accumulated depreciation and overstate the asset on the balance sheet, and the ledger would still balance."],

  // Corporate-card reconciliation matches (0160) — mirrors fin_reconciliation_matches (0145).
  ["fin_card_matches.insert", "Created ONLY by the DEFINER RPCs fin_auto_match_card / fin_match_card_txn (0160), which lock the card line, verify BOTH the card txn and the expense item belong to the caller's company, and enforce the one-match-per-charge + one-match-per-claim uniques. A direct client insert would bypass those checks and could substantiate a charge with another company's claim, or reimburse one claim against two charges."],
  ["fin_card_matches.update", "A match is not edited — it is deleted and re-made through the RPC, so the matched_by/matched_at attribution stays true. Mirrors fin_reconciliation_matches (0145), which is the deciding precedent for this whole surface (§A28)."],

  // Dunning / collections chase history (0159) — evidence, not a worklist row.
  ["fin_dunning_events.insert", "Written ONLY by the DEFINER RPC fin_record_dunning_action (0159) — no direct client insert path, so the recorded actor cannot be forged. A chase record is a claim about the outside world ('we sent this notice on this date'); it must be minted through the controlled path."],
  ["fin_dunning_events.update", "§3.1 append-only — a `do instead nothing` RULE blocks UPDATE (rules bind service-role and direct SQL too, unlike RLS). An editable chase record is not evidence: collections disputes are exactly the case where the history must be trustworthy."],
  ["fin_dunning_events.delete", "§3.1 append-only — `do instead nothing` RULE blocks DELETE. The chase trail is permanent record; a deleted reminder is indistinguishable from one never sent."],

  // Finance audit trail (0120) — an audit log you can write/edit/delete is not an audit log.
  ["fin_audit_log.insert", "§3.1 finance audit trail (0120): written by triggers/DEFINER only — no client insert path; a direct policy would let actors forge audit entries."],
  ["fin_audit_log.update", "§3.1 finance audit trail is immutable — an editable audit log is worthless as evidence."],
  ["fin_audit_log.delete", "§3.1 finance audit trail is permanent record — never deleted."],

  // Subledger→GL posting link (0122) — the traceability from a bill/invoice to its journal entry.
  ["fin_source_postings.insert", "Written only by the DEFINER posting functions (0122) — no client insert; the link IS the source→GL traceability."],
  ["fin_source_postings.update", "§3.1 immutable — the source→GL posting link is permanent evidence of what posted where."],
  ["fin_source_postings.delete", "§3.1 immutable — deleting a posting link would sever a journal entry from its source document."],

  // AP payments (0124) — recorded via the DEFINER pay-bill function through over-pay/lock guards.
  ["fin_payments.insert", "AP payments are recorded via the DEFINER pay-bill RPC (0124) — never a direct client insert; settlement must pass the over-payment + 0127 lock guards."],
  ["fin_payments.update", "§3.1 append-only — a payment is corrected by a reversing entry, never edited."],
  ["fin_payments.delete", "§3.1 append-only — a payment is never deleted; correct via reversal."],

  // AR receipts (0132) — recorded via the DEFINER receive-payment function through settlement guards.
  ["fin_receipts.insert", "AR receipts are recorded via the DEFINER receive-payment RPC (0132) — never a direct client insert; settlement passes the over-receive + 0132 lock guards."],
  ["fin_receipts.update", "§3.1 append-only — a receipt is corrected by reversal, never edited."],
  ["fin_receipts.delete", "§3.1 append-only — a receipt is never deleted; correct via reversal."],

  // Bank-reconciliation matches (0145) — created by the DEFINER match RPC.
  ["fin_reconciliation_matches.insert", "Created by the DEFINER bank-match RPC (0145) — no direct client insert."],
  ["fin_reconciliation_matches.update", "§3.1 append-only — a match is undone by the txn status, not by editing the match record."],
  ["fin_reconciliation_matches.delete", "§3.1 append-only — the reconciliation trail is permanent."],

  // Year-end close (0151) — performed atomically by the DEFINER fin_year_end_close function.
  ["fin_year_closes.insert", "Performed by the DEFINER fin_year_end_close RPC (0151) — never a direct client insert; the close runs the Dr-revenue/Cr-expense/RE roll-up atomically."],
  ["fin_year_closes.update", "§3.1 a closed year is immutable — reopening is a new event, never an edit of the close record."],
  ["fin_year_closes.delete", "§3.1 a year-end close is permanent record — never deleted."],

  // Status-lifecycle documents — never deleted; rejected/reconciled via status (data-as-asset).
  ["fin_expense_reports.delete", "§1.1 data-as-asset. Status lifecycle (0125): draft→submitted→approved→reimbursed / rejected — a report is rejected via status, never deleted."],
  ["fin_bank_transactions.delete", "Status lifecycle (0145): unmatched→matched — an imported transaction is reconciled via status, never deleted; the bank record is permanent."],

  // Config/dimension tables — deactivate/close, never hard-delete, so historical postings resolve.
  ["fin_cost_centers.delete", "Deactivate model (0147): is_active=false, never hard-delete — historical postings must keep resolving their cost center."],
  ["fin_projects.delete", "Lifecycle model (0147): status active→closed, never hard-delete — historical postings + project profitability must keep resolving the project."],
  ["fin_tax_codes.delete", "Deactivate model (0150): is_active=false, never hard-delete — posted transactions must keep resolving the tax code that applied."],
]);

// ─── Parse migrations ─────────────────────────────────────────────────

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// table → { rlsEnabled: bool, policies: Set<op>, drops: Set<op> }
const tables = new Map();
function ensure(name) {
  if (!tables.has(name)) {
    tables.set(name, {
      rlsEnabled: false,
      policies: new Set(),
      droppedTable: false,
      created: false,
    });
  }
  return tables.get(name);
}

// Tables that are INTENTIONALLY created without RLS (must be justified, same discipline
// as ALLOWLIST). Empty today: every table carries tenant isolation. A stateless/global
// reference table with no tenant data would go here WITH a reason — never silently.
const RLS_EXEMPT = new Map([]);

const RLS_ENABLE_RE = /alter\s+table\s+(?:public\.)?(\w+)\s+enable\s+row\s+level\s+security/gi;
// Policy names may be double-quoted ("files - select") OR a bare identifier
// (files_select). The original regex only matched the quoted form, so every
// table whose policies use unquoted names (0055 departments, 0057 files, …)
// was reported as having NO policies — a parser false-positive, not a real gap.
const POLICY_RE =
  /create\s+policy\s+(?:"[^"]+"|\w+)\s+on\s+(?:public\.)?(\w+)\s+for\s+(select|insert|update|delete|all)\b/gi;
const DROP_TABLE_RE = /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)/gi;
// Real CREATE TABLE — requires the opening `(` after the name so a PROSE mention inside a
// SQL comment (e.g. "-- `create table if not exists` above …") can't be mistaken for a real
// table. Used to catch tables created but never `enable row level security` — invisible to
// the per-operation policy check below, and the most severe case (no tenant isolation at all).
const CREATE_TABLE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(/gi;

// ─── Tenant-pin check: the implicit WITH CHECK trap (found 2026-07-13, fixed by 0154) ──
//
// Postgres reuses an UPDATE/ALL policy's USING expression as its WITH CHECK when no explicit
// `with check` is given. That is SAFE when USING pins the tenant (`company_id = auth_company_id()`),
// because the NEW row must satisfy it too. It is NOT safe when USING has a TOP-LEVEL `or` whose
// branch doesn't mention the tenant — e.g. the real bug in files_update (0057):
//
//     using ( uploader_id = auth.uid() or exists(<admin in same company>) )
//
// The uploader branch is satisfied regardless of company_id, so the implicit check let an uploader
// UPDATE their own file's company_id into ANOTHER tenant. A top-level `or` is the tell: it means at
// least one branch can pass without pinning the row's company.
//
// Note the depth test: an `or` NESTED inside an exists(...) (the CARE/coaching policies' role-choice,
// `is_support_agent or role in (...)`) is fine — the surrounding exists() still pins the company. Only
// a depth-0 `or` breaks the pin. That distinction is why this check has zero false positives here.
const POLICY_BODY_RE =
  /create\s+policy\s+("[^"]+"|\w+)\s+on\s+(?:public\.)?(\w+)\s+for\s+(select|insert|update|delete|all)\b([\s\S]*?);/gi;

// ─── Write-pin check #2: an EXPLICIT check that forgets the tenant (found 2026-07-13, fixed by 0155) ──
//
// The check above catches a MISSING with-check. This one catches a PRESENT one that doesn't pin the
// tenant. after_pitch_summaries (0080) declared:
//
//     for insert with check ( agent_id = auth.uid() );
//
// …on a table that carries `company_id uuid not null`. The agent is pinned, the TENANT is not — so a
// caller could insert a row stamped with another company's id. Rule: if a table HAS a company_id column,
// its insert/all policy must constrain company_id somewhere in the policy body.
// Extract each create-table body with a paren-DEPTH scan rather than a regex. Two reasons a regex
// fails here, both caught by the tests: (1) column definitions contain nested parens — numeric(19,4),
// check (status in (...)) — so a non-greedy `\(([\s\S]*?)\)` truncates at the first ')'; (2) anchoring
// the close to `\n)` silently misses a SINGLE-LINE create table, which would let such a table evade
// the company_id detection entirely (a real hole: the check would never fire for it).
const CREATE_TABLE_OPEN_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(/gi;
function eachCreateTableBody(sql, cb) {
  let m;
  while ((m = CREATE_TABLE_OPEN_RE.exec(sql))) {
    const name = m[1];
    let i = CREATE_TABLE_OPEN_RE.lastIndex;
    let depth = 1;
    while (i < sql.length && depth > 0) {
      const c = sql[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      i++;
    }
    cb(name, sql.slice(CREATE_TABLE_OPEN_RE.lastIndex, i - 1));
  }
  CREATE_TABLE_OPEN_RE.lastIndex = 0;
}
const tablesWithCompanyId = new Set();

// Policies intentionally exempt from the write-pin rules. Same discipline as ALLOWLIST: a concrete,
// VERIFIED reason, never "we think it's fine". Each below was traced to the mechanism that makes the
// missing company_id pin harmless.
const TENANT_PIN_EXEMPT = new Map([
  [
    "own profile - insert@profiles",
    "profiles.id is the auth.users PK — you can only insert YOUR OWN row, and it already exists (handle_new_user creates it with company_id NULL), so a second insert violates the PK. company_id is set only by the DEFINER onboarding/invite flows and frozen against self-change by the 0090 trigger.",
  ],
  [
    "notification_subscriptions_insert_own@notification_subscriptions",
    "company_id here is inert metadata: push delivery targets by USER, not company — sender.ts selects `.in('user_id', userIds)` (src/lib/notifications/sender.ts:103), never by company_id. A forged company_id cannot route another company's notifications to anyone. The legit route sets it from server-side getCurrentCompanyId().",
  ],
  // ── Trigger-frozen tenants ────────────────────────────────────────────
  // NOTE: this audit reads RLS only — it cannot see TRIGGERS. A trigger that freezes company_id is
  // strictly STRONGER than an RLS with-check (it also binds service-role, which RLS does not), so these
  // are safe. They must be exempted WITH the trigger named, never waved through.
  [
    "own profile - update@profiles",
    "company_id/role are frozen by the 0090 guard trigger (end-user writes cannot change them; DEFINER onboarding/invite flows and service_role pass). The RLS `using (id = auth.uid())` limits you to your own row; the trigger — which this RLS-only audit cannot see — pins the tenant.",
  ],
  [
    "chat_messages - update own recent@chat_messages",
    "0068 installs a guard trigger that raises if NEW.company_id / topic_id / author_id differ from OLD — 'only body is editable, history kept'. So the 30-minute self-edit cannot move a message between tenants; the trigger (invisible to this RLS-only audit) freezes company_id.",
  ],
  [
    "notification_subscriptions_delete_own@notification_subscriptions",
    "`using (user_id = auth.uid())` pins something STRICTER than the tenant: you may delete only YOUR OWN subscription rows — never your company's, let alone another company's. A company_id pin would be weaker, not stronger.",
  ],
  [
    "crm_accounts_insert@crm_accounts",
    "Vendor-global back-office table (0049): scoping dimension is is_vendor_super_admin(), not the tenant. company_id names the CUSTOMER company the vendor manages — a vendor super-admin creating an account for any company is the feature, and no one else can write it at all.",
  ],
  [
    "crm_accounts_select@crm_accounts",
    "Vendor-global back-office table (0049): reads are gated on is_vendor_super_admin(), which IS the authorization boundary here — the vendor manages every customer company, so the tenant is deliberately not the scoping dimension. No customer user can read this table at all (the 2026-07-07 CRITICAL fix, 3b150b8, is exactly this gate). Not a cross-tenant read: there is no tenant to cross into.",
  ],
  [
    "crm_accounts_update@crm_accounts",
    "Same as crm_accounts_insert: vendor-global table gated on is_vendor_super_admin(). The tenant is not the scoping dimension — managing any customer company's account IS the vendor's job, and no customer user can write this table at all.",
  ],
]);

// True if `using` contains an ` or ` at paren-depth 0 (a top-level disjunction).
function hasTopLevelOr(using) {
  let depth = 0;
  const s = using.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && s.startsWith(" or ", i)) return true;
  }
  return false;
}

// policyKey (name@table) → last-seen definition. Migrations are applied in order, so the LAST
// create-policy for a given name wins (drop-and-recreate is the fix idiom); evaluating an earlier,
// superseded definition would flag a bug that a later migration already fixed.
const latestPolicy = new Map();

// Recognize the dynamic policy-creation idiom used in 0001:
//
//   do $$ declare t text;
//   begin
//     foreach t in array array['tasks','team_members','decisions',...]
//     loop
//       execute format('create policy "%1$s - all" on %1$s for all ...', t);
//     end loop;
//   end $$;
//
// Without this, the static parser sees `on %1$s` and misses every
// table the block covers. We extract the array literal and the
// operation keyword, then apply the operation to each named table.
const DO_FOREACH_RE =
  /foreach\s+\w+\s+in\s+array\s+array\[([^\]]+)\][\s\S]*?execute\s+format\(\s*'\s*create\s+policy\s+"[^"]+"\s+on\s+%1\$s\s+for\s+(select|insert|update|delete|all)/gi;

/**
 * VIEWS THAT BYPASS RLS.
 *
 * A Postgres view runs with the privileges of its OWNER unless it is declared
 * `with (security_invoker = true)`. Migrations run as the table owner — so a view created without that
 * option reads its base tables WITHOUT applying the querying user's RLS policies.
 *
 * That is not a hardening nicety. It is a CROSS-TENANT READ: any authenticated user selecting from such a
 * view sees every company's rows, while `rls:audit` reports green, because every underlying TABLE is
 * correctly protected. The hole is in the lens, not the data.
 *
 * The project already learned this once — migration 0052_views_security_invoker.sql exists for exactly this
 * reason, and every finance view through 0150 sets the option. It was learned, codified in a migration, and
 * then NOT ENCODED IN A CHECK — so I broke it again in 16 views in a single session, and the audit stayed
 * green the entire time.
 *
 * A lesson that lives only in a past migration is a lesson the next author will re-learn the hard way.
 * This check is that lesson, made structural.
 */
const VIEW_RE = /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?(\w+)([\s\S]{0,120}?)\bas\b/gi;
// `alter view X set (security_invoker = true)` is the OTHER way to make a view safe, and the codebase uses
// it heavily (0052, 0060, 0071, 0076 all recreate a view and then ALTER it on a later line). A checker that
// only looked at the CREATE statement would flag all four as leaks.
//
// That false-positive matters more than it sounds. An audit that cries wolf on migrations that are
// correctly written is an audit people learn to skip — and the one real leak then rides in behind six fake
// ones. (§A25: a false match is worse than a miss.) So: track each view's state across migrations IN ORDER,
// last statement wins.
const VIEW_ALTER_RE =
  /alter\s+view\s+(?:public\.)?(\w+)\s+set\s*\(\s*security_invoker\s*=\s*true\s*\)/gi;

/** view name → { safe: boolean, file: string } — the state after the most recent statement touching it. */
const viewState = new Map();

for (const f of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8").toLowerCase();

  let m;
  while ((m = VIEW_RE.exec(sql))) {
    const [, viewName, between] = m;
    viewState.set(viewName, {
      safe: /security_invoker\s*=\s*true/.test(between),
      file: f,
    });
  }
  VIEW_RE.lastIndex = 0;

  // An ALTER later in the SAME file (or any later migration) repairs a view created without the option.
  while ((m = VIEW_ALTER_RE.exec(sql))) {
    viewState.set(m[1], { safe: true, file: f });
  }
  VIEW_ALTER_RE.lastIndex = 0;

  while ((m = RLS_ENABLE_RE.exec(sql))) {
    ensure(m[1]).rlsEnabled = true;
  }
  RLS_ENABLE_RE.lastIndex = 0;

  while ((m = POLICY_RE.exec(sql))) {
    const t = ensure(m[1]);
    if (m[2] === "all") {
      OPS.forEach((op) => t.policies.add(op));
    } else {
      t.policies.add(m[2]);
    }
  }
  POLICY_RE.lastIndex = 0;

  while ((m = DO_FOREACH_RE.exec(sql))) {
    const arrayLiteral = m[1];
    const op = m[2];
    const tableNames = [...arrayLiteral.matchAll(/'([^']+)'/g)].map(
      (x) => x[1]
    );
    for (const name of tableNames) {
      const t = ensure(name);
      if (op === "all") {
        OPS.forEach((o) => t.policies.add(o));
      } else {
        t.policies.add(op);
      }
    }
  }
  DO_FOREACH_RE.lastIndex = 0;

  while ((m = DROP_TABLE_RE.exec(sql))) {
    ensure(m[1]).droppedTable = true;
  }
  DROP_TABLE_RE.lastIndex = 0;

  while ((m = CREATE_TABLE_RE.exec(sql))) {
    ensure(m[1]).created = true;
  }
  CREATE_TABLE_RE.lastIndex = 0;

  while ((m = POLICY_BODY_RE.exec(sql))) {
    const [, rawName, tbl, op, body] = m;
    const name = rawName.replace(/"/g, "");
    latestPolicy.set(`${name}@${tbl}`, { table: tbl, op, body, file: f });
  }
  POLICY_BODY_RE.lastIndex = 0;

  eachCreateTableBody(sql, (name, body) => {
    if (/\bcompany_id\b/i.test(body)) tablesWithCompanyId.add(name);
  });
}

// ─── Tenant-pin findings ──────────────────────────────────────────────
// Two distinct traps, both letting a caller write a row into ANOTHER tenant:
//   (a) implicit  — no `with check`, and USING has a top-level `or` that skips the tenant (files_update).
//   (b) explicit  — a `with check` that simply never constrains company_id (after_pitch_summaries).
const tenantPinFindings = [];
for (const [key, p] of latestPolicy) {
  if (TENANT_PIN_EXEMPT.has(key)) continue;
  const hasCheck = /with\s+check/i.test(p.body);

  // (a) update/all with NO explicit check → Postgres reuses USING; a top-level `or` breaks the pin.
  if (!hasCheck && (p.op === "update" || p.op === "all")) {
    const um = p.body.match(/using\s*\(([\s\S]*)\)\s*$/i);
    if (um && hasTopLevelOr(um[1].replace(/\s+/g, " ").trim())) {
      tenantPinFindings.push({ key, op: p.op, file: p.file, kind: "implicit check (top-level OR)" });
      continue;
    }
  }

  // (b) A WRITE policy (insert/update/delete/all) on a company_id-bearing table whose body never
  // constrains company_id. Covers the explicit-check trap (after_pitch_summaries: pinned the agent,
  // forgot the tenant) and — most consequentially — DELETE, where an unpinned USING would let a caller
  // destroy ANOTHER company's rows. A policy that pins something STRICTER than the tenant (e.g.
  // `user_id = auth.uid()`, which limits you to your own rows) is safe and belongs in TENANT_PIN_EXEMPT
  // with that reasoning, not silently.
  if (p.op !== "select" && tablesWithCompanyId.has(p.table)) {
    if (!/\bcompany_id\b/i.test(p.body)) {
      tenantPinFindings.push({ key, op: p.op, file: p.file, kind: "policy never pins company_id" });
    }
  }

  // (c) READ side — the highest-severity class: a SELECT policy on a company_id-bearing table that pins
  // NEITHER the tenant NOR an identity is a cross-tenant read (straight exfiltration). An IDENTITY pin
  // (`… = auth.uid()`) is accepted as safe because your identity belongs to exactly one company, so
  // "your own rows" is a strict SUBSET of "your company's rows" — narrower than a tenant pin, never
  // wider. That is why profiles / notification_subscriptions / dissect_topics / after_pitch_summaries
  // are sound despite never naming company_id (and why the 0155 forged row was invisible to its victim).
  if (p.op === "select" && tablesWithCompanyId.has(p.table)) {
    const pinsTenant = /\bcompany_id\b/i.test(p.body);
    const pinsIdentity = /auth\.uid\(\)/i.test(p.body);
    if (!pinsTenant && !pinsIdentity) {
      tenantPinFindings.push({
        key,
        op: p.op,
        file: p.file,
        kind: "SELECT pins neither the tenant nor an identity — cross-tenant READ",
      });
    }
  }
}

// ─── Find gaps ────────────────────────────────────────────────────────

const findings = [];
const noRlsFindings = [];
for (const [name, t] of tables) {
  if (t.droppedTable) continue;
  if (!t.rlsEnabled) {
    // Created but never `enable row level security` → NO tenant isolation at all. More severe
    // than a missing per-operation policy. Only flag genuinely-created tables (the map also holds
    // phantom entries from FK/policy references to system tables), and honor RLS_EXEMPT.
    if (t.created && !RLS_EXEMPT.has(name)) noRlsFindings.push(name);
    continue;
  }
  for (const op of OPS) {
    if (t.policies.has(op)) continue;
    const key = `${name}.${op}`;
    if (ALLOWLIST.has(key)) continue;
    findings.push({ table: name, op });
  }
}

// ─── Report ───────────────────────────────────────────────────────────

console.log("═══ ELOSTATE RLS policy audit ═══");
console.log(`  Migrations scanned:    ${files.length}`);
const rlsTables = [...tables.values()].filter(
  (t) => t.rlsEnabled && !t.droppedTable
);
console.log(`  RLS-enabled tables:    ${rlsTables.length}`);
console.log(`  Allowlisted omissions: ${ALLOWLIST.size}`);
console.log(`  Tables without RLS:    ${noRlsFindings.length}`);
console.log(`  Tenant-pin risks:      ${tenantPinFindings.length}`);
console.log(`  Missing policies:      ${findings.length}`);
// Resolved after every migration has been read, so a view repaired by a LATER migration is not flagged.
// (Within a single file, an ALTER is treated as winning over a CREATE — which is how 0071/0076 are written.)
const leakyViews = [...viewState.entries()]
  .filter(([, v]) => !v.safe)
  .map(([view, v]) => ({ view, file: v.file }));

console.log(`  RLS-bypassing views:   ${leakyViews.length}`);

if (VERBOSE) {
  console.log("\n  Per-table policy coverage:");
  for (const [name, t] of tables) {
    if (t.droppedTable || !t.rlsEnabled) continue;
    const covered = OPS.filter((op) => t.policies.has(op)).join("/");
    const missing = OPS.filter(
      (op) => !t.policies.has(op) && !ALLOWLIST.has(`${name}.${op}`)
    );
    const allowed = OPS.filter((op) => ALLOWLIST.has(`${name}.${op}`));
    console.log(
      `    ${name.padEnd(28)} have=${covered || "(none)"}  allowed=${
        allowed.join("/") || "(none)"
      }${missing.length ? `  MISSING=${missing.join("/")}` : ""}`
    );
  }
}

if (noRlsFindings.length > 0) {
  console.log(
    "\n  ⚠ Tables CREATED but never `enable row level security` (NO tenant isolation):"
  );
  for (const name of noRlsFindings.sort()) {
    console.log(`    ${name}`);
  }
  console.log(
    "\n  Each is fully exposed to any authenticated caller. Add\n" +
      "  `alter table <name> enable row level security;` + policies in a migration,\n" +
      "  or add it to RLS_EXEMPT in this script with a documented reason."
  );
}

if (tenantPinFindings.length > 0) {
  console.log(
    "\n  ⚠ UPDATE/ALL policies whose implicit WITH CHECK may not pin the tenant:"
  );
  for (const t of tenantPinFindings) {
    console.log(`    ${t.key}  (for ${t.op}, ${t.file}) — ${t.kind}`);
  }
  console.log(
    "\n  These have NO explicit `with check`, so Postgres reuses USING as the new-row check —\n" +
      "  but USING has a TOP-LEVEL `or` whose branch can pass without pinning company_id. A caller\n" +
      "  can UPDATE a row they own and move it into ANOTHER tenant (this is the real files_update\n" +
      "  bug, fixed by 0154). Add an explicit `with check (company_id = auth_company_id() and <...>)`\n" +
      "  — re-asserting the USING condition, since an explicit check REPLACES the implicit one —\n" +
      "  or add the policy to TENANT_PIN_EXEMPT with a documented reason."
  );
}

if (leakyViews.length > 0) {
  console.log("\n✗ VIEWS THAT BYPASS RLS (missing `with (security_invoker = true)`):\n");
  for (const v of leakyViews) {
    console.log(`    ${v.view.padEnd(34)} ${v.file}`);
  }
  console.log(
    "\n  A view without security_invoker runs as its OWNER, so the querying user's RLS policies are\n" +
      "  NOT applied to its base tables. Any authenticated user selecting from it reads EVERY company's\n" +
      "  rows — a cross-tenant leak this audit would otherwise report as GREEN, because the underlying\n" +
      "  tables ARE protected. The hole is in the lens, not the data.\n" +
      "  See 0052_views_security_invoker.sql — the project learned this once already."
  );
}

if (
  findings.length === 0 &&
  noRlsFindings.length === 0 &&
  tenantPinFindings.length === 0 &&
  leakyViews.length === 0
) {
  console.log(
    "\n✓ Every table has RLS enabled, every operation is covered or documented, every update/all\n" +
      "  policy pins the tenant on write, and every view runs as the invoker."
  );
  process.exit(0);
}

if (findings.length === 0) {
  console.log("\n✗ RLS gaps found (see above).");
  process.exit(1);
}

console.log("\n  Missing operations (must add a policy or allowlist):");
const byTable = new Map();
for (const f of findings) {
  if (!byTable.has(f.table)) byTable.set(f.table, []);
  byTable.get(f.table).push(f.op);
}
for (const [table, ops] of byTable) {
  console.log(`    ${table.padEnd(28)} ${ops.join(", ")}`);
}
console.log("\n✗ RLS policy gaps found.");
console.log(
  "  For each gap: either add a `create policy ... for <op>` in a new migration,\n" +
    "  or add an entry to ALLOWLIST in this script with a constitutional reason."
);
process.exit(1);
