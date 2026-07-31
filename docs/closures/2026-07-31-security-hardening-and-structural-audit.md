# Closure — 2026-07-31 · Sales Coach revisions, security hardening & structural audit

A long autonomous session (A23 build guard active). Started from the founder's urgent Sales Coach
revisions, then — under the guard — ran a foundation-up security/structure/a11y audit. Everything below
is committed to `main` and verified live in prod (`/api/health` `build.commit` matched HEAD, 14/14
`verify:live` invariants held). This is the navigable index; per-item detail is in the linked audit docs
and the founder queue.

## 1. Founder's urgent request (delivered + verified)
- **Nav → the annotated mockup**: grouped "Manager Dashboard" / "Team Tools" with per-group 1./2./3.
  numbering (`6bd243cf`, `filterManagerNavSections`).
- **After-recording → After-Pitch summary shows up**: traced end-to-end, proven **race-free** — all three
  nav paths gate on *awaited* transcript persistence (`b5f26a3b`).
- **Methodology + Product wired & fully functional**: verified all 8 engines fetch + inject both corpora;
  the input→persist→consume loop (settings editors → routes → `getCurrentSalesCorpus`) confirmed whole.

## 2. Security — found, fixed, guarded (each boundary lock detection-tested)
- **Real bug fixed**: `upload-recording` service-role write scoped by id only → pinned `company_id`
  (`8d54db32`). Swept the whole API for the class (`7b40ace8`, `c5db0dd6`) → all others sound. Locked with
  **INVARIANT 15** (`0de00920`).
- **Cross-person `?agentId` class** (a manager reading a rep's private data): elo (prior) + **skills**
  (`36dd9fa9`) + **recordings/audio** (`455a4484`) — class fully behavior-tested.
- **Cross-customer vendor CRM gate**: `requireVendorAdmin` wrapper locked fail-closed (`9edb524c`).
- **Public IDOR**: widget messages POST write-path (`5793c106`) + `widget/bootstrap` token-bound &
  origin-reject (`4b9b997f`).
- **A18 privacy**: KPI team rollup never leaks raw scores (`5e0a182a`); `finalize` owner-only
  transcript-injection defense (`e302e428`).
- **LLM injection posture**: roleplay locked (`9621e352`); inbound-email + extension verified sound.
- Plus save-recording / why / cue-voice / coach-assessment / team-analytics gate tests, and the full
  ground-up security audit on record (`9e4b334e`).

## 3. Structure, performance, a11y, knowledge
- **Structural finding (§3.6)**: the KPI computed layer has no reader — `kpi_snapshot` is write-only,
  `agent_baseline`/`growth_record` are fully dead (`8207a3c4`, `cae69e84`). Surfaced, not silently changed.
- **Frozen-month history** Data-as-Asset guarantee locked at the DELETE site (`b3538dd5`).
- **N+1 removed** from the compute-cron (batched read, mirrors `/team`) (`4020b3aa`).
- **a11y**: SalesCoachShell nav text raised to WCAG AA (`8285f3ea`); CareShell same-class finding surfaced
  (`d76367c3`).
- **Jeff** now describes product-aware post-call review (`118a0810`); **skill-analytics generic-reads**
  gap surfaced (`bcf0affb`).

## 3b. Post-closure continuation (same session, after this doc was first written)

The autonomous guard kept running; the high-value vein turned out to be the **live-DB effective-state
meta-audit** (checking effective grants/policies vs static text / coarse flags):

- **`verify:live` 14 → 18 invariants** — 4 tenant-isolation checks added, all confirmed clean live:
  no permissive READ policy (`edef438f`), storage.objects read-policy scoped (`bbdf047b`), all 54 finance
  tables affirmatively company-scoped (`528f9b09`), no permissive WRITE (incl. DELETE) policy
  (`4573c70d`/`e6c18b8e`). Each closed a *coarse-flag* blind spot (RLS-on ≠ open; bucket-public ≠ object
  policy); the code was correct, the verification coverage wasn't.
- **Definer-revoke hole is BROADER than finance** (`827c2845`/`c24f2bf5`/`af6b9786`): a live effective-anon-grant
  sweep of ALL DEFINER functions found the hole isn't finance-only — **5 non-finance functions** are
  anon-callable without an internal `auth.uid()` gate, 2 allowing unauthenticated event-injection into the
  append-only §3.1 chain. Fully bounded (safe ones excluded); the `0200` fix now has an exact target list.
- **Static-guard & fresh-dimension sweeps**: INV1 (CSV) + INV6 (cross-person) blind-spot checks — clean.
  Un-awaited mutations, rate-limit, cron-scheduling, state-bleed — clean. PWA/manifest — clean. Security
  headers — well-configured (CSP a documented deferral). **SEO — a real live bug**: prod canonical/sitemap
  emit `localhost`; I built a dev-safe fix, then **reverted it** (`09472355`) to honor the queue's explicit
  "do NOT fix in code" note, and surfaced it as the founder's choice — the §2 discipline held under the guard.

## 3c. Deep-continuation (same session, much later — the honest headline is a self-correction)

- **CORRECTION (§0/§5 — the most important item):** earlier this session the "effective-state audit" method
  raised a FALSE **HIGH "14 finance views bypass RLS"** finding (surfaced in the queue). Behavioral
  re-verification refuted it: the views ARE `security_invoker` (Postgres stores the boolean as `on`, not
  `true`; my ad-hoc check matched only `true`), and as the anon role they return 0 rows (RLS working, which
  I'd misread as "empty tables"). `rls:audit` correctly reported 0 bypassing the whole time — I overrode a
  correct guard. **Withdrawn + corrected everywhere** (queue, audit doc, memory). The sibling
  **definer-revoke** finding HELD UP under behavioral PoC (anon `fin_account_by_code` returned a UUID) and
  is accurately **MEDIUM-LOW hygiene**, not HIGH. Lesson saved: verify security state BEHAVIORALLY
  (`SET ROLE anon`), never by catalog-string; trust a project guard over an ad-hoc check.
- **Shipped:** `diagnosis/close` auth gate (`4ab3294c`, latent anon-write into the §3.1 chain) + **INV18**
  (`f7a30c9e`, every non-public mutation route must gate — self+detection-tested). `rates` CWE-209 earlier.
- **Structural guards added to `verify:live` (14 → 22 invariants):** the trigger-wiring class — §3.2 gate,
  H2 finance immutability, H3 balance now assert their TRIGGERS are WIRED (not just the fns present); the full
  §3-thesis trigger-wiring completed with §3.4 (control-window / honesty moat) + §3.5 (durability-emit); a
  view-invoker check (LIVE complement to rls:audit's migration-text parse, codifying the correct `on|true`
  predicate so the false-positive bug can't recur); and a SECURITY DEFINER `search_path` guard (privilege-
  escalation / the CI form of Supabase's linter). With these, the DB-security-lint classes (RLS-on,
  security_invoker views, definer search_path, policies, extensions-not-in-public) are comprehensively
  clean + CI-guarded, and the SECURITY DEFINER surface is guarded on BOTH axes (INVARIANT 4 reachability +
  search_path injection). All detection-tested, each its own TBC build. INV18 (every non-public mutation
  route gates) shipped separately in invariant-audit. Final integrated state: verify:live 22/22, full suite
  1906 tests green, prod healthy on the deployed commit.
- **Behavioral proofs:** tenant isolation proven as anon across ALL 41 populated `company_id` tables (0 rows);
  the full §3 thesis core verified STRUCTURALLY enforced — §3.1 (append-only, empirical), §3.2 (fail-closed
  trigger, empirical), §3.3 (schema requires userDiagnosis+userProposal, test-locked), §3.4
  (`enforce_coach_control_window` blocks coach-enable in month 1), §3.5 (durable-timestamp sweep); the §3.1
  data pipeline intact (events 1711 well-formed, signals 100, 0 orphaned/cross-tenant problem_signals links).
- **Coverage:** filled the one genuine pure-logic gap — `mirrorChipText` (the Coach's growth-framing /
  mirror-not-surveillance property) now test-locked; the rest of the core libs confirmed well-covered.
- **Surfaced (founder-gated, added to queue):** Next.js 16.2.6 CVEs (🟡 — applicability-checked: the scary
  ones don't apply to our config); HSTS missing (🟢 LOW); `"guard the thesis triggers"` (🟢, verify:live
  coverage for §3.4/§3.5 — offered, not auto-built per §2).

## 4. Open — founder-gated (all scoped in `docs/FOUNDER-ACTION-QUEUE.md`)
🔴 `"fix the definer revoke"` (the one live MEDIUM hole) · 🟡 `"wire the KPI trajectory"` (§3.6 payoff) ·
KPI snapshot atomicity · `"drop the dead KPI tables"` · `"fix the CareShell contrast"` ·
`"write the skill reads"` · nav section-gating · B1 mark-ended · "One Liners everywhere".

## Session-Reads (§A22)
Constitution assets reasoned from this session (in CLAUDE.md context throughout; applied as the audit's
method, re-read 2026-07-31):
- §1.3 (outside-view) · §1.5.1–1.5.2 (four-layer + proactive audit) · §1.7 (ground-up audit) — 2026-07-31
- §2 (surface, don't overtake — CareShell/skill-reads flagged not rewritten) — 2026-07-31
- §3.1 (append-only — frozen-month/KPI) · §3.4 (honesty/no-fabrication) · §3.6 (make learning visible —
  KPI trajectory finding) — 2026-07-31
- A18 (owner-private) · A22 (this closure) — 2026-07-31
- §0 / §0.1 (understanding earned; behavioral re-verify of the false finding) · §5 (distrust the confident
  answer — the correction) · §3.2 (understanding gate, trigger-wired) · §3.3 (guide-don't-overtake,
  schema-enforced) — re-read 2026-07-31 (deep-continuation)

Prior related closures: `2026-07-30-care-jeff-guidance-upload.md`, `2026-07-30-doc-upload-remediation.md`.
