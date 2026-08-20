# Schedule Management System — Phase 8 ground-up audit (§1.7)

_Performed 2026-08-20, outside-view stance (§1.3), foundation-up. Flags carry severity. An empty flag list at a
layer is treated as suspicious and re-examined, not assumed clean (§1.7)._

Legend: **OK** = verified clean · **FLAG** = needs action · **N/V** = not verifiable from this sandbox (needs live DB/prod).

## Layer 1 — Environment / toolchain
- **OK** — `npm run check` (typecheck · lint · theme:audit · rls:audit · invariant:audit · test + tbc stages) is
  green at exit 0 (3407 passing this session). CI reproduces the secretless build. Deploys verified against
  `/api/health` `build.commit` == HEAD each push.

## Layer 2 — Schema / events (§3.1 append-only)
- **OK — event-integrity intact.** No code path issues UPDATE/DELETE/upsert on `schedule_event`, and nothing
  writes a derived-state table directly (swept: `from('schedule_event').(update|delete|upsert)` and
  `from('schedule_(shift|state|derived)')` → both empty). Corrections are new events (UNASSIGN then ASSIGN).
- **N/V (runnable) — RLS + append-only live-verification.** Migrations 0230 (event RLS + manager reads),
  0227/0228 (manager-only RPC + tenant param), 0220 (append-only trigger + revoke) are on the ledger. The
  behavioral verifier `scripts/diag-schedule-security.mjs` proves them under simulated JWTs (rolled back) —
  non-manager insert/read blocked, cross-tenant isolation, and (added this pass) the **append-only** invariant:
  authenticated UPDATE/DELETE blocked by the revoke AND the trigger RAISES on UPDATE even for a privileged writer
  (the "trigger present in a migration ≠ trigger wired + firing" blind spot). It needs prod DB access to RUN —
  **run it at go-live** (`node scripts/diag-schedule-security.mjs`), not writeable from this sandbox.

## Layer 3 — Derivation (projections)
- **OK** — state is derived by replaying events (`deriveState`); the grid, export, and coverage all read the
  projection, never a stored mutable table.

## Layer 4 — Constraints (hard vs soft, §4)
- **OK** — hard vs soft is explicit in the type: every `HardViolation` carries `overridable: boolean`
  (`coverage`/`unavailable` = true; `ineligible`/`double_booked`/`time_off_conflict`/`over_hours` = false).
  Overnight-span awareness is handled in availability/time-off/coverage (both calendar days).

## Layer 5 — Verdict authority (A40 / §2.2 — the money rule)
- **OK — no verdict re-derivation.** The decision is computed once in `evaluateChange` (`authority.ts`) and
  returned as a verdict; `absolute = violations.filter(v => v.overridable === false)` is the single source of the
  approve/override branch. Consumers (`resolution.ts`, `assignEval.ts`, `assistant/route.ts`) consume the
  returned `violations` and make a **documented, intentional** display choice with `!== "coverage"` (coverage is
  surfaced in the gaps view; `unavailable` is excluded from auto-suggest but kept as a per-employee warning) —
  this is per-consumer policy, not a re-derivation of the overridable verdict.
- **Watch (low)** — the "coverage is the shift-level one to exclude" policy is encoded as the literal kind
  `"coverage"` in two consumers. Correct today; if a *second* shift-level overridable kind is ever added, those
  consumers must be revisited. Not a current defect.

## Layer 6 — AI layer (§3.3 / §5)
- **OK** — the LLM interprets + phrases; the deterministic authority decides. The assistant proposes; the
  manager confirms via Apply before any event is appended. No auto-write.

## Layer 7 — Interface (§1.5.1 layers 3–4)
- **OK** — export/import round-trip audited this session end-to-end: file upload accepts `.csv`, deterministic
  time-range mapping is wired into both re-import paths, commit uses replace-the-week (no duplication), and the
  preview warns the replace-count + date range before commit. Six real defects found + fixed; subsequent lenses
  (30-staff pagination, commit non-duplication, replace-warning, VA cross-path) verified clean.

## Config preconditions (A41 / §1.5.3 — fail-loud or documented)
- **FLAG (blocking, low-severity workaround)** — migration **0234** (`companies.schedule_name`) for the custom
  name WRITE: read degrades to the company name; write fails **loud** (503 naming 0234). Apply via `npm run db:apply`.
- **FLAG (conditional)** — migration **0223** (`p_cancel_shift_ids`, replace-the-week): if unapplied, a re-import
  that would replace shifts fails **loud** (MIGRATION_REQUIRED), never silently appends duplicates.
- **OK** — DeepSeek is the active provider (`/api/health` `activeProvider: deepseek`, `llmReady: true`).
- **N/V** — Supabase env across BOTH Vercel projects + Vercel cron secret: verify per environment on go-live.

## Summary
Structural invariants (event-sourcing integrity, single-authority verdict, hard/soft distinction, guide-don't-
overtake) all **hold**. Open items are the two documented migration preconditions (fail-loud) and the live-DB
checks (RLS behavioral, per-environment env) that require prod access at go-live. No new code defect found in
this pass.
