# BUILD_MANIFEST.md — AI Schedule Management System

Tracks the phased build of `ScheduleManagementSystem.md` (Supabase/Vercel/DeepSeek). Build in order;
each phase ends at a founder checkpoint; never build ahead (plan working-agreement).

## Phase status

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Event Store & Derivation Foundation | ✅ **DONE — at checkpoint** | `0220` live, pure projector + append/read API, 17 tests, gate exit 0, append-only verified live. Commit `40f8ddb1`. |
| 2 | Coverage Requirements & Constraint Model | ✅ **DONE — at checkpoint** | schedule_employee roster (`0221`) + pure hard/soft predicates + 20 boundary tests. Commit pending. |
| 3 | The Decision Authority (single verdict, A40) | ⬜ pending | Composes the predicates + state-dependent checks (S1: double-book / time-off-overlap / rest). Also RQ6: role-per-event-type authz. Coverage=block-overridable; zero-impact time-off=auto-approve. |
| 4 | AI Reasoning Layer (DeepSeek propose; deterministic gate) | ⬜ pending | Needs DeepSeek + per-env config (A41). |
| 5 | Manager/Admin Interface | ⬜ pending | First user-facing surface (layers 3-4). **Includes FILE UPLOAD (PDF/Excel/CSV) for staff + schedule-template entry** (S3; samples: HUB SCHED.pdf / frendz.xlsx). Employee CRUD + manager-only write gate (S4). |
| 6 | Employee Interface | ⬜ pending | |
| 7 | Make Learning Visible & Close the Loop | ⬜ pending | |
| 8 | Ground-Up Audit & Hardening (1.7) | ⬜ pending | Full A41 sweep. (RQ2 permanent append-only invariant already landed early — verify:live category (d).) |

## Decisions log (grounded, override welcome)

- **Tenancy = `company_id`** — A28 precedent (166 migrations vs 0 for `org_id`). `org_id` in the plan maps to it.
- **D1 — `schedule_event` is a new table** (not the generic `events`). Spec-as-written.
- **D2 — no materialized derived-state tables in Phase 1** — A31 (no schema without a read-consumer); the pure projector is the source. Revisit when a Phase 5/6 reader needs a materialized read.
- **Append-only = fail-loud raise-trigger + revoked grants** — the plan's choice over `0004`'s silent rule (honesty, 3.4). Verified live.

## Founder decisions — RESOLVED (2026-08-19 picker)

- **RQ5 — employee model:** STANDALONE staff records (no Elostate account required); user_id link is a future addition. The scheduling system is a standalone tool for managers/admins. ✅
- **Coverage minimum:** block-by-default, manager-overridable, gap marked. ✅
- **Zero-impact time-off:** auto-approve. ✅
- **NEW — file upload (PDF/Excel/CSV)** for staff + schedule-template data entry → Phase 5. ✅

## Open founder decisions
- None currently blocking. Phase 3 is ready to proceed on your go.

## Residual queue
See `docs/tbc/2026-08-19-schedule-event-foundation/closure.md` (A36-ranked): RQ1 (opened/closed), RQ2–RQ5.
