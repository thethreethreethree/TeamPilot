# BUILD-STATE — durable unfinished-work + risks ledger

> **READ THIS FIRST ON RESUME.** If a build was interrupted (founder paused, internet dropped,
> context compacted, machine died), this is the single file that says *exactly* what was mid-flight,
> what is done, what is NOT done, and the risk of each unfinished item. It is maintained *during*
> every build — not written at the end — so it is never more than one step stale.
>
> **Invariant:** an item is only "done" when it has evidence (a grep / test / read-path you can point
> to, A38). "Reported done while partial" — the recurring failure this ledger exists to kill — is
> structurally impossible if every requested item lives here with an honest disposition.
>
> Companion mechanism: each *revision* build also carries `docs/tbc/<dir>/revision.md` (every atomic
> requested change → a tracked disposition), enforced at closure by `npm run tbc:revision`.

---

## ▶ ACTIVE BUILD

**slug:** `2026-07-30-care-jeff-guidance-upload` (IN PROGRESS — ~20%, PAUSED mid-build 2026-07-30)
**instruction (verbatim intent):** two founder images (2026-07-30): (1) "add [the multi-format Upload-a-file
feature] to the C.A.R.E system if we don't have it yet"; (2) "add this feature as well but not strictly
formated for sales but Jeff's customer assistance guidance." Decisions locked via AskUserQuestion:
NEW dedicated "Customer-assistance guidance" field for Jeff (methodology-equivalent, wired into Jeff's
replies) + multi-format upload on THREE surfaces: Adaptive Knowledge (facts), the new guidance field,
and "What you represent" (ai_product_context).
**source:** founder chat + 2 images (2026-07-30).

### Requested items → disposition

| id | item | disposition | notes |
|----|------|-------------|-------|
| J0 | New guidance field — migration + config + type | **DONE (uncommitted, green)** | `0202_care_assistance_guidance.sql` (care_tenant_config.ai_assistance_guidance, NOT applied); config.ts type+mapper (A34-safe via select *); widgetSafe test confirms NO leak to the public widget |
| J1 | extractText per-caller cap (maxChars param) | **DONE (uncommitted)** | extractText(buf, name, {maxChars}); default 100k; backward-compatible; epub threaded |
| J2 | Jeff prompt injects the guidance block | **HALF — param added, block NOT injected** | prompt.ts has `assistanceGuidance?` param (currently UNUSED no-op) — must push the block into `sections` AND wire the 3 callers (messages/demo/email routes) to pass `config.aiAssistanceGuidance` |
| J3 | Save + serve guidance | **NOT STARTED** | extend `/api/care/agent/tenant` PATCH+GET to accept/return ai_assistance_guidance (admin-gated); pick a cap (~8000 like product-context, prompt-budget) |
| J4 | Shared C.A.R.E extract route | **NOT STARTED** | `/api/care/agent/acms/extract` — requireCareAgent(+isAdmin), extractText with per-field maxChars, 4MB cap, typed errors; + invariant-audit UPLOAD_VALIDATE_ALLOWLIST entry |
| J5 | DocUploadButton `endpoint` + `maxChars` props | **NOT STARTED** | make it reusable (default = sales-coach route) so all C.A.R.E surfaces can use it |
| J6 | Guidance editor UI + upload | **NOT STARTED** | new editor (care settings) for ai_assistance_guidance + DocUploadButton |
| J7 | ACMS Adaptive Knowledge multi-format upload | **NOT STARTED** | `AdaptiveKnowledgePanel.tsx` — broaden `accept`, route non-text through J4, cap 200000 |
| J8 | Product-context (ai_product_context) upload | **NOT STARTED** | its editor in care/settings/widget + DocUploadButton, cap 8000 |
| J9 | Tests + Jeff product knowledge + TBC + commit | **NOT STARTED** | route auth test, guidance save+prompt test; update elostateProductKnowledge.ts; TBC build dir |

### Status — COMPLETE (all J0–J9 done, committed, check exit 0)
- All 10 J-items DONE end-to-end: new Jeff guidance field wired into his replies (scoped within his core
  rules), multi-format upload on all THREE C.A.R.E surfaces, A34-guarded. `npm run check` exit 0 (1654
  tests); care extract route 4/4, guidance prompt 3/3, widgetSafe 3/3.
- ⚠ Migration `0202` written but NOT applied (A34-guarded → Jeff unchanged + guidance-save says "migration
  pending" until founder `db:apply`). Residuals: CARE-01 (live post-apply check), CARE-02 (8k cap tunable),
  CARE-03 (per-surface browser click-through).

---

## ▶ CARRY-OVER QUEUE — real open work across the project (not this build)

> These are the genuinely-not-built items so a resume never treats them as done. Ordered by the
> founder's stated priority. Each names its risk.

| item | state | risk if left / note |
|------|-------|---------------------|
| **AMD-009 ratification** — makes `tbc:revision` mandatory (adds to `tbc` chain) + inserts BUILD-PROTOCOL.md 7.1 + 8.3 + bumps constitution.ts | PROPOSED, awaits founder | say "ratify AMD-009". Until then the revision gate is runnable but not auto-enforced (bounded risk). |
| **Settings admin scope (S1–S4)** — was the active build, DISPLACED by the C.A.R.E build | PARTIAL — resume after C.A.R.E | **S1 Theme DONE** (`03bc57d4`+test `ef64f350`; migration 0201 not applied). **S3 Timezone foundation DONE** (`c33f461a`); NEXT: broad adoption (TZ-01) + per-user override (TZ-02); **TZ-03 finding OPEN** (company timezone free-text but formatter needs valid IANA → silent local time; fix = IANA dropdown/validate-on-save). **S2 Learning** off-by-default satisfied; admin-flip HELD (profile-creation migration, founder applies+tests). **S4 Access Assistance** DECIDED "build fully" (admin temp-password + must_change_password + login gate) — SECURITY-SENSITIVE, needs founder's 2 mechanism decisions (enforcement point + session handling). |
| **DEFINER-revoke `0200`** — ~50 finance SECURITY DEFINER fns anon-callable (cross-tenant config read) | FOUNDER-GATED | MEDIUM security. Fix written + de-risked. Live finance change → needs founder "fix the definer revoke". |
| **Per-tenant AI-cost cap** | SPEC READY, awaits founder NUMBERS | distributed abuse unbounded below tenant until set. 5-surface spec written. |
| **`ANTHROPIC_API_KEY`** (Vercel) | FOUNDER CONFIG | prod is DeepSeek-only → no AI failover (single point of failure). Failover code built + test-locked; activates on key set. |
| **`NEXT_PUBLIC_BOOKING_URL`** (Vercel) | FOUNDER CONFIG | /care/demo "Book a demo" dead-ends at /login → demo not prospect-ready. |
| **`NEXT_PUBLIC_SITE_URL`** (Vercel) | FOUNDER CONFIG | sitemap/canonical say localhost (SEO only; NOT pilot-blocking). |
| **VAPID×3 + `CRON_SECRET`** (Vercel) | FOUNDER CONFIG | VAPID → push delivery; CRON_SECRET → PII-purge crons. |
| **Doc-upload hardening (LOW, from 2026-07-30 self-audit)** | NOTED | all bounded by the manager-gate + platform, none must-fix: (1) a zip-bomb in .docx/.odt/.epub decompresses fully before the char-cap — bounded by Vercel memory/maxDuration + manager-gate + self-tenant; (2) the route says "15 MB" but Vercel's serverless body limit (~4.5 MB) is the real ceiling — align the message/verify; (3) a binary file renamed .txt decodes to garbage (manager reviews before Save). Route auth+format boundary now test-locked. |
| **Finance FX-rounding imbalance (CONFIRMED 2026-07-30, MEDIUM)** | FOUNDER-GATED (money model + untestable-here DB migration) | per-line base rounding (`0118:83-84`) vs a base-sum balance check (`0118:152/199/258`) → a face-balanced foreign entry can be REJECTED as unbalanced (`0118:202`). Full write-up + concrete failing example + fix options: `docs/audits/2026-07-30-fin-fx-rounding-imbalance.md`. Recommend option 1 (FX-rounding-adjustment account + tolerance). Say "fix the FX rounding" to build the 0203 migration for review. |
| **Self-hosted Voice system** | STAGED (0%) by founder choice | not started by design; repo location decided later. |
| **Post-deploy click-throughs** | AWAITS DEPLOY | founder-manual-download + auth-landing verify in prod after next deploy. |

---

## ▶ AUDIT BASELINES (swept class boundaries — for the next audit)

- **Finance audit (read-only, 2026-07-30) — 1 real bug, rest clean/honest:** (1) 🔴 FX post-rounding
  rejects face-balanced foreign entries — the ONE live defect, fix-ready (`docs/audits/2026-07-30-fin-fx-
  rounding-imbalance.md`, founder-gated). (2) ✅ foreign SETTLEMENT guard COMPLETE across all payment/
  receipt paths (direct + delegation + base-only) — no unguarded path. (3) ✅ TAX: per-line rounding is a
  legit method; credit-note un-netting is DEFERRED **and UI-warned** (`tax/page.tsx:110` tells the user the
  figure overstates if they've credited invoices) — honest, not silent. (4) 🔴 **NEW — year-end close +
  budgeting SILENTLY assume a CALENDAR fiscal year** (`0151` extract(year)/make_date(y,1,1..12,31);
  `0149:54`) while periods are FREE-FORM (`0117:16`) — a non-calendar FY company (Apr–Mar, Jul–Jun) gets a
  WRONG year-end close (wrong net→RE), wrong period locks, wrong budget variance, with NO warning. MEDIUM-
  HIGH, founder-gated. Write-up: `docs/audits/2026-07-30-fin-fiscal-year-calendar-assumption.md`. Fix: add
  fiscal_year_start_month + derive the window, OR enforce/warn calendar-only. (5) year-end RE roll-up MATH
  itself is CORRECT (sums stored base exactly, break-even handled, balances). (6) ✅ BANKING recon clean —
  sign correctly derived from the bank line (`0163:92-99`, incl. an explicit "posted-backwards-still-
  balances" guard); exact-amount + ±3d matching surfaces discrepancies, no silent absorption. (7) ✅
  DEPRECIATION clean — final period CLAMPED to the remaining base (`0166:13-16`) so the asset lands exactly
  at salvage (no rounding residual), append-only entries. **VERDICT: comprehensive money-op audit — 2 real
  bugs (FX rounding, calendar-FY), everything else correct + honesty-disciplined (the system is well-built;
  banking/depreciation/settlement code explicitly defends the 'balances-but-silently-wrong' class).**

- **C.A.R.E build post-audit (2026-07-30) — 3 findings fixed:** (1) guidance could soft-override Jeff's
  honesty rules → explicit precedence guard + test (`2bb31de6`); (2) the A34 deferred-column-drop logic was
  untested + inline → extracted to `deferredColumnsToDrop` + 4 tests (`531b0d7a`); (3) **REAL BUG** —
  `extractText` sliced to the CONST cap, ignoring the per-caller `maxChars`, so a Jeff-guidance/product
  upload (8k) would overflow to 100k + fail to save (F5 recurrence) → `slice(0, maxChars)` + 2 tests
  (`b303df99`). The default masked it (const == default). Class swept: only extractText's slice + the
  epub bound use the cap; both now honor maxChars.
  **Class sweep CODEBASE-WIDE (2026-07-30):** `grep "\.slice(0, [A-Z_]{4,}"` across src — every other
  const-cap slice (FREQUENT_SIGNAL_TOP_N, MAX_TOP_CONCERNS, MAX_QUOTE_LEN, TTS_MAX_CHARS, MAX_SOURCE_CHARS,
  TREND_N, …) uses its const as the INTENDED fixed limit; none shadows a param-derived variable. So the
  "computed-limit-ignored-for-const" class is bounded to the single fixed extractText instance — CLEAN.
  Also verified: all 5 upload surfaces pass a maxChars == their field's save cap (SC 100k, guidance/product
  8k, knowledge 200k) — cap-consistency CLEAN, F5 dead-end structurally impossible.

- **F5 class — "a producer whose output cap exceeds its consumer's save cap"** — swept codebase-wide
  2026-07-30 (`grep content:.*max( in api` + upload→field producers). Instances: doc-upload extraction
  (was 500k > 100k save — FIXED `74dfc387`, gated). Sound: C.A.R.E ACMS upload (`AdaptiveKnowledgePanel
  .tsx:75` byte-check ≤ save char-cap, since UTF-8 chars ≤ bytes). All other setText producers are
  user-typed (field-bounded), not automated. Class CLEAN beyond the fixed instance.

## ▶ RECENTLY CLOSED (rolling, newest first)

- `2026-07-30-x2-care-jeff-guidance-upload` — CLOSED 2026-07-30 — new Jeff customer-assistance guidance
  field (wired into his replies) + multi-format upload on 3 C.A.R.E surfaces. Migration 0202 (not applied,
  A34-guarded). check exit 0 (1654 tests).
- `2026-07-30-x-doc-upload-remediation` — CLOSED 2026-07-30 (`74dfc387`) — formal 2-pass audit + fix:
  F5 cap-seam, F3 body-limit, F2 double-decode (gated); F1/F4 declined (A33). check exit 0 (1647 tests).
- `2026-07-30-sales-coach-doc-upload` — CLOSED 2026-07-30 — clients upload docs (pdf/docx/odt/epub/
  rtf/html/txt/md) that fill the Coaching Methodology + Product editors; objection rules now drive BOTH
  live coach + role play (un-truncated). New: extractText + unpdf, /extract route, DocUploadButton,
  objectionGuidance. check exit 0 (1637 tests). No migration.
- `2026-07-29-x4-theme-reconcile-race-fix` — CLOSED 2026-07-29 — audit-found race in the theme reconcile.
- `2026-07-29-x3-settings-timezone-foundation` — CLOSED 2026-07-29 — shared timezone formatter
  (formatInTimeZone/resolveTimeZone, 8/8) + first consumer (Settings last-saved). check exit 0.
- `2026-07-29-x2-settings-theme` — CLOSED 2026-07-29 (`03bc57d4` + test `ef64f350`) — theme company
  default + per-user override + DB persist.
- `2026-07-29-x-revision-completeness-mechanism` — CLOSED 2026-07-29 (`b76bdc84`) — durable ledger
  (this file) + revision-completeness gate (`tbc:revision`) + AMD-009 proposal. check exits 0. M6/M7
  (ratification) → carry-over queue.
- `2026-07-29-sales-coach-revision-completion` — CLOSED 2026-07-29 (`86c987fa`) — declutter (4 strings) +
  Standard post-session → after-pitch routing. 2/2 items done.
- `7-day build audit PDF` — DELIVERED 2026-07-29 — `BUILD-AUDIT-7DAY-2026-07-29.pdf` (repo root, untracked
  founder deliverable). 12 initiatives, % completion.
- `2026-07-28-x2-settings-profile-name` — CLOSED (`e8cf99d4`) — edit-your-own-name.
- `2026-07-28-x-founder-manual-download` — CLOSED (`096638ab`) — founder-only build-manual download.
- `auth-entry` — CLOSED (`cdc41701`) — show-password toggle (6 fields) + module-aware landing.
- `TBC install (AMD-008)` — CLOSED (`c53c87b9` + F1–F5 fixes) — THINK·BUILD·CHECK mandatory.

---

*Discipline: update the ACTIVE BUILD table the moment an item's disposition changes; move a build to
RECENTLY CLOSED only when its closure.md exists and `npm run check` is green. An empty ACTIVE BUILD
section means no build is in flight — safe to stop.*
