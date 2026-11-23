# CHECK - Call notes, and erasure that reaches every copy of a customer's words

## Commands

```
npx vitest run src/lib/__tests__/erasureCoverage.test.ts → first run: 7 call-keyed text tables uncovered (agent_point_ledger,
  ai_usage, feedback_requests, gamification_calibration, manager_notifications, session_failures, training_scenarios) →
  feedback_requests and manager_notifications added to the erasure; the others listed with why → 2 passed
npx vitest run "src/app/api/coach/sales-session/[id]/notes" → 4 passed
npm run check → first: ✗ RLS gaps (call_notes update/delete → allowlisted: append-only), ✗ A second path into erasure
  (invariant 38 → 0316 named as an extension with its reason) → exit 0 · Tests 6535 passed | 15 skipped
```

Full migration chain on PGlite, then an erasure of one of two calls:

```
before erasure, delete ignored: { notes: 2, briefs: 1 }
erasure result: {"sessions":1,"call_notes":1,"call_briefs":1,"followup_drafts":1,"transcript_lines":1,"prospects_renamed":1,
  "prospect_tasks_blanked":2,"feedback_messages_blanked":1,"notifications_scrubbed":2,…}
after: lines 0 · other_lines 1 · notes 0 · other_notes 1 · briefs 0 · reviews 0 · drafts 0 · tasks "To-do (details erased
  on request)" · prospect name "(erased on request)", organization null, amount 900 kept · label null · feedback null,
  other call's feedback kept · notifications {"client_label": "[erased]"} / {"excerpt": "[erased]"} · sessions 2
after erasure, rules hold again: { notes: 1 }
```

Production after applying:

```
npm run db:apply → applying 0316 … ok · DB now at 0316 · ✅ ALL 33 invariants hold
rss_erase_sessions mentions remote_call_briefs / call_notes / manager_notifications: true / true / true
erasure-aware no_delete rules (briefs, drafts, feedback, notes): 4
```

## Findings

### F1 - erasing a customer left their words in tables created after 0285
class: an obligation (§3.1.1) not extended when new call-keyed text tables were added.
sweep: erasureCoverage.test.ts over every migration → remote_call_briefs, remote_checklist_reviews, remote_followup_drafts,
remote_prospect_events (name/organization), feedback_requests, manager_notifications; all now covered.
severity: high

### F2 - practice scenarios built from a call may describe the customer
class: manager-written, immutable text linked to a call.
sweep: `grep -n "source_session_id" supabase/migrations/0282_rss_p7_training.sql` → linked; immutable by trigger.
severity: medium
