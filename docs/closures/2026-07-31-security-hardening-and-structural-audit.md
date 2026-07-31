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

Prior related closures: `2026-07-30-care-jeff-guidance-upload.md`, `2026-07-30-doc-upload-remediation.md`.
