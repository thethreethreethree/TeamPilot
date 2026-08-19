# Phase 2 — Build

## Built

| path | what | clause |
|------|------|--------|
| `supabase/migrations/0221_schedule_employee.sql` | the standalone staff roster (company_id, name, role, employment_type, skills[], certifications[], max/min_hours_week, status; RLS company-scoped; updated_at trigger). NO user_id — standalone now, Elostate link is future (A31). | RQ5 decision, A28 (mirrors profiles), A31 |
| `src/lib/schedule/constraints.ts` | pure predicates: `meetsCoverage`/`isEligible`/`withinLimits` (HARD → pass/fail), `fairnessScore` (SOFT → score), `shiftDurationHours`. Hard/soft kept in distinct return shapes. | plan section 4, §2 (locked doors), §5 (deterministic) |
| `src/lib/schedule/types.ts` (+Employee) | the `Employee` roster type the predicates read. | §3.1 |
| `src/lib/schedule/__tests__/constraints.test.ts` | 20 tests incl. the required boundaries: exactly-at-min coverage MEETS, exactly-at-max hours WITHIN, overnight shift, NaN-safety, hard/soft-not-conflated. | A30 |

## Decisions (founder picker, 2026-08-19)
- Employees = **standalone** records (no Elostate account); user_id is future → omitted now (A31).
- Coverage = **block-by-default, manager-overridable** (consumed by Phase 3 verdict + Phase 5 UI).
- Zero-impact time-off = **auto-approve** (Phase 3 behavior).
- **NEW: file upload (PDF/Excel/CSV)** for staff/schedule entry → Phase 5 (validated vs real samples HUB SCHED.pdf / frendz.xlsx — a staff×date grid of shift codes).

## Features (reachability inventory)

### schedule_employee roster
The standalone staff table the constraint + schedule layers reference by id.
- write-path: PENDING — the manager management UI + the PDF/Excel/CSV import both write it (Phase 5). Founder-directed model (RQ5); this is a foundation table, honestly NOT yet wired to a writer.
- read-path: PENDING — the Phase-3 eligibility resolver reads it (roleOf / employee lookup). Honestly NOT yet wired to a reader.

### constraint predicates
`meetsCoverage`/`isEligible`/`withinLimits`/`fairnessScore` — pure evaluation the authority runs.
- write-path: N/A — pure functions, no persisted state. Their INPUTS are the derived ScheduleState (Phase 1) + Employee rows; the human "sets" those via events + the roster.
- read-path: EXISTS at the library altitude — imported + exercised by `constraints.test.ts`; the runtime consumer is Phase 3 (the single verdict authority) + Phase 4 (resolution search). Correctness proven by 20 boundary tests.

## Step 7 — Reachability (A31), honest note
Phase 2 is **pre-surface layer-1 logic**, not a user-facing feature with a live DB seam. The predicates are
reachable/proven at the library altitude (tests). `schedule_employee`'s write+read seam is genuinely NOT wired
yet — its writer (Phase 5 management UI + file-upload) and reader (Phase 3 eligibility) are the next phases.
Per A31 this is disclosed, not hidden: the roster is a founder-directed foundation table, and it is NOT claimed
as a complete reachable feature until Phase 3/5 wire its seam (tracked as residual S2).
