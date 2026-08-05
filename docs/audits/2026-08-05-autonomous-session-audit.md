# Autonomous session audit — 2026-08-05

On-record audit trail (§1.7.4) for the 2026-08-05 session so a later audit can compare against this
baseline instead of re-checking the classes verified clean here. All work is committed to `main` and gated
on `npm run check` (CI confirmed green via the check-runs API across the session).

## Headline
Founder request delivered (Sales Coach: no minimum length — every session generates all content, honesty
preserved, verified engine→pixels, guarded, all ripples traced). Then a sustained ground-up audit: one
systemic authz-vocabulary gap fixed + gated, several coverage gaps on sensitive routes closed, a drift-guard
class extended, and ~8 high-consequence classes verified clean.

## Founder request — delivered + verified
- **Sales Coach no-minimum-length.** Removed BOTH "too thin" layers (LLM prompt refusals + engine
  3-4-segment floors) across every v5 engine; `§3.4` honesty preserved (short call → short REAL read). Verified
  the four named surfaces render engine→pixels; cost ripple bounded (rate-limited + cached); Sales-ELO ripple
  traced BENIGN (quality is a ratio, not a count — quick wins score well). Locked by 4 detection tests
  (unit + integration) + an ELO short-win guard. TBC: `docs/tbc/2026-08-05-salescoach-no-minimum-length/`.
  **Founder action: confirm on one real short pitch (RES-01).**

## Gaps FOUND + FIXED (committed)
- **Systemic §A13 authz-vocabulary gap.** `roles.ts` is the single source for the admin set, but ~12 gates
  (RoleSchema + after-pitch + careAgentAuth + Sidebar + 5 server routes + 3 client sites) hardcoded
  `CEO||COO||admin` inline — a real drift risk. Migrated ALL to `isAdminRole`/`INVITABLE_ROLES` (each verified
  behavior-preserving, full suite green), boundary confirmed clean, **locked with an A30 guard**.
- **6 CRM enum drift contracts** (TS unions ↔ Postgres `create type … as enum`, migration 0049) were
  unguarded — the existing enum guard only covered `col in (…)` CHECKs. Now guarded (12 assertions).
- **Authz deny-path coverage** on 4 sensitive routes that had ZERO tests: `leadership/readouts`,
  `leadership/team`, `care/coach-assessment`, `feedback/[id]`. Deny paths pinned.
- **Vendor-CRM (past-CRITICAL 0089):** verified all 6 `admin/crm` routes consume `requireVendorAdmin`
  correctly across every method (incl. the 2 non-standard consumers), + a **structural guard** so a future
  ungated CRM route fails CI.
- Smaller: a comment misrepresenting an enforced sync as "by convention" + a mis-cited axiom (§A4→§A13); a
  low-severity UTC-vs-local "last edited" stamp.

## Verified SOUND (no fix needed — the baseline for future audits)
- **CSV formula-injection (CWE-1236):** every export routes through `neutralizeCsvFormula` (`toCsv` /
  `statementsToCsv`); imports are not the vector; the `.join(",")` hits are PostgREST filters.
- **LLM prompt-injection fence:** all 14 customer-reply routes go through `generateCareReply` → the
  `prompt.ts` fence (defangs forged delimiters, hardened vs a past forged-fence refund attack). Coach
  transcript engines use `CONVERSATION_IS_DATA`, guarded by INVARIANT 23. Defang primitive comprehensively
  tested (`knowledgeFence.test.ts`).
- **Fire-and-forget serverless writes:** `after()` adopted where needed; no unprotected `void asyncWrite()`.
- **localStorage/sessionStorage throws:** every access guarded (try/catch) — team is uniformly disciplined.
- **Append-only double-write:** `useRef` latch pattern widely adopted (~10 components).
- **KPI compute coverage:** every exported metric in `compute.ts` is tested (a survey false-positive on
  `winLossRatio` was caught by direct verification — it IS tested 5×).

## Data-integrity findings (LATENT, founder-gated fix — NOT customer-facing fires)
- **coach-assessment windowed aggregate** (`.limit(300)` team-wide → per-rep count/content wrong for reps
  outside the window; worsened by the no-minimum build). MEDIUM, manager roll-up only. **One-word triggers in
  the queue.**
- **assetReadout unbounded select** (file view/download/citation counts truncate past 1000). LOW — internal
  founder-files feature, latent. Same-class fix (server-side count/RPC).
- Confirmed CLEAN where it matters: no customer-facing unbounded aggregate (`support_messages` reads are
  conversation-scoped, ≤38 rows).

## Initially flagged, then RESOLVED safely
- `chat/topic-decisions` authz test — first deferred (compound gate + full POST flow → risk of a
  false-confidence mock). Then done the disciplined way: read EVERY branch of the route first, wrote a
  faithful table-aware mock, and locked the compound-gate property (a company admin who is NOT a
  participant is still denied). 7/7 green. The flag was correct while the flow was unread; once read, the
  faithful test was achievable — that is the §5 concern honored, not skipped.

## Live production verification (read-only, 2026-08-05) — SUPABASE_DB_URL, `SET default_transaction_read_only=on`
The session's second half re-verified the risk record against LIVE prod (SELECT-only). Net: 2 stale claims
CORRECTED, several confirmed WITH EVIDENCE, 1 false positive AVOIDED, 1 severity clarified, and the highest-value
security check made REPEATABLE.
- **Multi-tenant isolation — behaviorally PROVEN (the strongest result).** As `ROLE anon`: 0 rows from all
  tenant tables. As an AUTHENTICATED user (JWT `auth.uid()` verified to match first, so it isn't an anon
  re-test): sees own company's 2 sessions, **0 of another tenant's 121**. Made repeatable — new `verify:live`
  invariant "tenant isolation BEHAVIORAL: ROLE anon reads 0 from POPULATED tenant tables" (`1059fcd5`),
  converting the by-hand `SET ROLE anon` proof into a permanent guard (behavioral-beats-catalog-string).
- **Money integrity — SOUND.** Both double-entry balances hold; `fin_journal_lines` has 0 rows → the GL is
  UNUSED in prod, so the flagged FX-rounding imbalance bug is MAXIMALLY latent (no data to corrupt).
- **Data-integrity claims re-verified (corrections):** transcript corruption is NOT "stable" — 132 excess/13
  sessions, up +4/+1, newest collision yesterday → actively (slowly) accruing. Onboarding: NO advisory lock
  exists (the queue implied one) — server can still double-create; 0 REAL orphaned tenants (the 10 orphans are
  `chain-test-*` test CRM accounts, NOT the TOCTOU — false alarm avoided). Truncation: still vendor-only
  (0 customer groups >1000). Transcript blast radius CORRECTED 8→11 distinct suspect sessions (after-pitch
  summaries were uncounted) + exact IDs listed; ELO auto-corrects on re-generation (computed on-read, no stored
  table).
- **Deploy — live + healthy:** `/api/health` `build.commit` == git HEAD, `status: ok`; all commits deploy:success.

## Constitutional-invariant registry — AUTOMATED (2026-08-06)
`docs/constitutional-db-invariants.md` was, by its own words, the "human-review defense" — it named the gap:
"until an order-aware invariant check is added, this registry is the human-review defense." That gap is now
closed. Every enforceable category is asserted live in `verify:live`, so a migration that silently DROPs any
constitutional trigger/rule FAILS instead of relying on a reviewer (the §5 schema-layer risk). Each guard was
DETECTION-TESTED (breaking the expected object makes the check fail and name it; reverting restores green).
- **§3.1 append-only set** (`270417a`) — all 22 registry tables, encoding the live per-table MODEL (rules for
  the frozen set; the guard/freeze TRIGGER for chat_messages/support_messages/resolutions; no_delete-only for
  feedback/smoke_test_versions). A blanket rule-only check would false-fail the trigger-guarded members — that
  distinction was live-verified, not assumed.
- **§3.1 column-freeze + Security authz-column guards** (`fbb3bff8`) — 7 triggers WIRED with correct
  timing/events: the privilege-escalation defenses (profiles/chat_participants/care_agent_state guard triggers —
  self-escalation via direct column write, the 2026-07-07 CRITICAL's class) + the column-freezes
  (chat_topic_decisions/chat_topics/team_invitations/decision_dialogues).
- **§3.5 durability loop** (`e0785e4d`) — extended to BOTH emit triggers (resolutions + chat_topics), not just
  resolutions.
- Already-guarded categories confirmed: §3.2 understanding gate, §3.4 control window, SECURITY DEFINER
  search_path, RLS/tenant isolation, events append-only, fin immutability/balance.
- **Registry accuracy corrections found along the way** (`aba11b37`, `84df463c`): the three then-pending (2026-07-09)
  invariants are now live; the "every table has a _no_update rule" claim was wrong for 3 members (documented,
  with a "do NOT 'fix' chat_messages into a freeze" warning); the resolutions freeze cited the FUNCTION name as
  the trigger and listed only the pre-0105 3-column freeze (0105 extended it to 6 — added
  decided_by/company_id/problem_id). Not yet automated (lower priority / by design): `is_vendor_super_admin`
  logic (route-tested) and the documented app-layer-only "enforcement asymmetries."

## Needs YOU (founder-gated — one-word triggers in the queue)
- `RES-01` — confirm Sales Coach on one real short pitch.
- `"fix the coach-assessment count"` / `"redo the coach-assessment window, N=<n>"`.
- Standing items: IP copy rewrite, VAPID vars, pricing numbers (in the queue).
