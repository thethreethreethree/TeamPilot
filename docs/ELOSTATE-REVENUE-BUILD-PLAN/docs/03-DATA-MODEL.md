# 03 — Data model

Every table is append-only (no-update and no-delete rules, except under `rss.erasure`). Each has RLS with `company_id = auth_company_id()`, the restrictive `mfa_required` policy (0309) and `rss_not_hidden` where a row points at a call (0341). Current state is a `security_invoker` view over the events.

## Phase 1 (migration 0370)

| Table | Columns | Read | Write |
|---|---|---|---|
| `accounts` | id, company_id, created_by, created_at | anyone who can see a deal on it or a call linked to it, or who created it | insert: any member of the company, `created_by = auth.uid()` |
| `account_events` | id, account_id, company_id, kind (`name`), value, actor_id, created_at | as the account | insert: someone who can read the account |
| `accounts_current` (view) | id, name, key, created_at | — | — |
| `contacts` | id, company_id, created_by, created_at | anyone who can see one of its deals or calls, or who created it | insert as above |
| `contact_events` | kind `name` / `title` / `account`, value | as the contact | as above |
| `contacts_current` (view) | id, name, title, rank, account_id | — | — |
| `deal_contacts` | prospect_id, contact_id, role, actor_id, created_at; latest row per pair wins; `role = 'removed'` takes it off | as the prospect | insert by someone who can see the prospect |
| `call_contacts` | session_id, contact_id, speaker (`customer`), actor_id | as the call | insert by someone who can see the call |
| `remote_prospect_events.kind` | + `account` (value `{account_id}`) | — | — |

`remote_prospects_current` gains `account_id` at the end of the view (a view can only gain columns at the end, as in 0313/0325).

**Backfill:** for each company, each distinct organisation on a prospect becomes one account by `accountKey`, written as an `account` event by the prospect's rep. It runs once, as part of the migration, and can be re-run safely (it skips prospects that already have an account).

**Erasure (§3.1.1):** contact names and titles are personal data. `rss_erase_sessions` erases the contacts that appear only on the erased calls. It must be added through `ERASURE_EXTENSIONS` (INVARIANT 38: a single door). An account name is a company, not a person, so it's kept.

## Phase 2 (0371)
`deal_stages(company_id, id, position, name, kind open|won|lost)` with its events, plus `remote_prospect_events.kind` + `stage_id`. `deal_board_views(user_id, name, filters jsonb, columns jsonb)`.

## Phase 3 (0372)
`deal_warning_settings` (company, one events row per change) · `deal_warnings(prospect_id, kind, event raise|clear, reason, at)` · `playbooks`, `playbook_elements` · `deal_playbook(prospect_id, playbook_id)` · `deal_element_notes(prospect_id, element_id, action, note, ai_seqs jsonb, actor_id)` · `deal_suggestions(prospect_id, field, text, source_session_ids, accepted_by)`. A warning is written only by the service role (the nightly job), and no person can insert one.

## Phase 4 (0373)
`account_activity(account_id, window, level, score, computed_on)`, written by the job only.

## Phase 6 (0374)
`forecast_boards`, `forecast_columns`, `forecast_submissions` (append), `forecast_snapshots` (the job only).

## Deliberately absent
- No CRM id columns (R2).
- No email tables (R7).
- No score columns for likelihood (R8).
- No split percentages (R9).
