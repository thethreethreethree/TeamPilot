# Session-Read Manifest: truncation / false-limit class closure

**Date:** 2026-08-12
**Session:** autonomous build (000f2306)
**Commits in scope:** `760cc644`..`92534b81` (15 commits; the per-build detail lives in `docs/tbc/2026-08-12-x{r..y}/`)
**Builder:** Agent

## 1. What this build does

Closed the silent-truncation-at-1000 class across the app. PostgREST caps every row-returning read at
`max_rows = 1000`, so unbounded / `.limit(N>1000)` reads that are then aggregated in JS go silently wrong past
1000 rows. Eight sites were fixed to page the full set (`fetchAllPaged`) or to disclose an honest cap: the rep
Sales-Coach dashboard, CARE agent analytics, the sales-session list badge/signal reads, the KPI compute-cron
agent enumeration, admin coach-readout (×3), brain learning-summary, and the finance bank register (disclosure).
The class's mechanical guard (INVARIANT 21) was made self-cleaning so a fix that removes a limit can't leave a
stale allowlist entry behind, the trickiest fixes got detection tests, the shared error-adapter was consolidated
and tested, and a `LARGE-READS.md` pre-merge checklist was wired to INV21's finding so the correct pattern
surfaces at the moment of a violation. Also fixed a capture-flow recovery message that misattributed an STT-service
failure to the recording. Only `src/lib/data/care.ts` (the c5fbd454 KEEP/REVERT) remains in the allowlist.

## 2. Constitutional assets cited

| Asset | First cited in | Re-read in session at | One-sentence intent | Behavior in this build |
|---|---|---|---|---|
| §3.4 | `760cc644` | 2026-08-12T10:46Z | A failure/incompleteness must be visible, never a silent wrong/empty. | Embodies — dashboard fails loud not zero; finance register discloses its cap; paged-read errors still fire the honest-error path. |
| §1.5.1 | `760cc644` | 2026-08-12T10:46Z | Holistic — trace every ripple of a change. | Embodies — each limit removal re-synced its allowlist entry (the ripple xt caught and xu automated). |
| §1.5.2 | `ea0d1284` | 2026-08-12T13:31Z | Proactive audit with an evidence bar; name boundaries, don't over-reach. | Embodies — fixed the >1000 false bounds; NAMED the ≤1000 windowed reads + the no-rotation gap rather than silently expanding scope. |
| §1.2 | `4a689501` | 2026-08-12T12:35Z | Retrospective — diagnose from the record, not theory. | Embodies — the xt drift was diagnosed from xr's own diff; the fixes drew on the recorded "fix the false limits" item. |
| §5 | `fe864e25` | 2026-08-12T15:16Z | The builder under pressure is the biggest risk; don't trade honesty for motion. | Embodies — under the build guard, chose verifiable test/refactor work over hunting; DECLINED to manufacture findings once the vein dried. |
| §1.6 | `92534b81` | 2026-08-12T15:35Z | Close the loop — a resolution becomes a reusable/teachable asset. | Embodies — INV21 self-cleans; LARGE-READS.md teaches the pattern, wired to the guard's finding. |
| §3.3 / A24 | queue docs | 2026-08-12T11:35Z | Guide, don't overtake; no gold-plating past completion. | Embodies — held on every founder-gated item (care.ts, message-thread, finance UI, KPI rotation) with options, never unilaterally. |
| A16 | `ea64bf52` | 2026-08-12T14:00Z | Compose, don't fork — reuse shared helpers. | Embodies — every fix used the one `fetchAllPaged`; the adapter became one shared `fetchAllPagedResult`. |
| A30 | `aae87850` | 2026-08-12T11:20Z | Gate the lesson in a test; a guard must be proven to bite. | Embodies — list/finance/adapter detection tests, each mutation-checked; the self-cleaning allowlist has a self-test. |
| A38 | all builds | 2026-08-12 (per build) | "Verified" = the command + its output. | Embodies — every build's closure pastes the `npm run check` output at exit 0. |

Every cited asset has a session re-read timestamp (per-build manifests in the TBC dirs carry the granular set).

## 3. Findings

### Resolved this session
- 8 truncation sites fixed + deployed green; INV21 made self-cleaning; detection tests added (list, finance,
  adapter); capture recovery-message honesty fixed; money-precision re-verified clean; LARGE-READS checklist wired.

### Deferred with recommended remediation order (per A20)
1. **care.ts `c5fbd454` KEEP/REVERT** — the sole remaining allowlist entry; a decision, not a build. *Recommend
   KEEP* (the fix is genuine, low-risk, tested) — but it's the founder's provenance-consistency call.
2. **Message-thread pagination** — real bug (long threads hide newest messages); the keyset `.or()` cursor is
   **unverifiable without live Postgres**, so it must be built in a live-DB session, not this sandbox. *Recommend
   the "load older" UI (option A) for support + tasks* per the proposal.
3. **Finance register load-older UI** — the disclosure ships; retrieval needs a UX pick. *Recommend a "load older"
   button* consistent with the register's read pattern.
4. **KPI agent rotation past BATCH_AGENTS=100** — a design choice; dormant subsystem, lowest urgency.
5. **Onboarding advisory-lock migration** — `db:apply`-gated; verified not-materialized in prod (preventive only).

### Open uncertainties (per A4 — answered by data later)
- Whether any customer thread/register will actually cross 1000 rows before the founder ships the load-older UIs
  (prod severity pin 2026-08-04 said only ELOSTATE's own `events` group exceeds 1000 today).

## 4. Outside-perspective audit (per A19 / feedback_outside_perspective_post_build)

### New user
- The analytics/KPI fixes are invisible — numbers just become correct at scale (no user-facing change). Good.
- The **finance register disclosure** is the one new-user-facing surface: "Showing the most recent 1,000 of N
  transactions — older lines aren't listed here yet." **Honest, but it can read as mild alarm** ("where's the
  rest?") with no in-surface way to reach the older lines. That's the intended trade (honest-incomplete beats
  silently-incomplete), but it **raises the priority of the load-older UI** — the disclosure creates an
  expectation it doesn't yet satisfy. Surfaced for the founder as deferred item #3.

### New engineer
- `LARGE-READS.md` wired to INV21 answers "what do I do instead?" at the moment of the flag — the main onboarding
  win. Residual confusion risks: the `.order("id")` stable-key requirement (a paged read without it silently
  skips/dups — the doc warns, but it's an easy miss) and the self-cleaning allowlist (removing a limit now
  *forces* removing the allowlist entry — surprising until you read the finding message, which explains it).

### Adversary
- No new attack surface. `fetchAllPaged` has a 200k-row backstop (throws rather than spins), the finance
  head-count is RLS-scoped on the same user client, and the paged reads are the same RLS-scoped queries as before.
  Residual (already flagged): a `.in(id-list)` built from a >1000-row driving set carries a >1000-value IN-list —
  bounded today by the 300-session list cap; the durable fix is a server-side aggregate RPC.

### CFO / operator
- **Net positive, and this is the persona the class most serves.** A register that silently hid transactions, a
  KPI cron that silently skipped agents, and analytics that silently undercounted are exactly the
  quiet-wrong-number failures an operator can't audit for. The register now *discloses* incompleteness (auditable),
  every agent now gets a KPI snapshot (no silently-missing rows in reporting), and the analytics are correct past
  1000 rows. The operator can now trust the dashboards at scale — the whole point of the honesty thesis.

## 5. Cross-module check (per A21)

Same-name-different-feature surfaces touched: the `fetchAllPaged`/`fetchAllPagedResult` helpers are now shared
across coach (dashboard/list/KPI cron), CARE (agent analytics), brain (learning-summary), and admin (coach-readout)
— one paging primitive, no per-module fork. The FALSE_LIMIT allowlist is the single registry of intentional
exceptions across all of these; its self-cleaning check keeps every module honest by the same rule.

## 6. Verification checklist

- [x] `npm run check` green at exit 0 on every build in scope (typecheck/lint/theme/rls/invariant/tbc/test)
- [x] Final suite: Test Files 399 passed | 1 skipped; Tests 2750 passed | 15 skipped
- [x] Every constitutional citation in the commits has a row in section 2
- [x] Every row in section 2 has a session-read timestamp
- [x] Every row in section 2 has a one-sentence behavior comparison
- [x] Section 4 has a finding per persona (the finance-disclosure UX raise + the two new-engineer footguns are the
      non-obvious ones)
