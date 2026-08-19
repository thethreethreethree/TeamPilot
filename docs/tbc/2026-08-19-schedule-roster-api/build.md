# Phase 5 (part 1) — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/app/api/schedule/employees/route.ts` | Roster API. GET → the company's roster (RLS-scoped, paged). POST → create staff, MANAGER-ONLY (ctx.isAdmin, RQ6); company_id server-resolved (tenant-pin); honest read error. | RQ6/S2, §3.4, tenant-pin |
| `src/app/api/schedule/employees/__tests__/route.test.ts` | 6 tests: manager creates (201) with session company_id (ignores a hostile body.companyId), non-manager 403 + no write, 401 unauth, 400 invalid, GET roster, GET 401. | A30 |

## Resolves
- **S2** (Phase 2 residual) — schedule_employee's WRITE path now exists.
- **RQ6** (the manager-only write gate) — enforced at the API for the roster; the same class applies to the event-append route + the file-upload writer.

## Features (reachability inventory)

### staff roster
Create + list staff members.
- write-path: EXISTS — `route.ts` POST → insert into schedule_employee (manager only). The manual add-form (next UI unit) and the PDF/Excel/CSV import both write here. human_can_set: true (a manager).
- read-path: EXISTS — `route.ts` GET → the company's roster; the constraint/authority layers + the roster UI read it. human_can_see: true.

## Step 7 — Reachability (A31)
The roster write+read seam is now WIRED (POST writes, GET reads) — this closes the Phase-2 honest note that
schedule_employee had no writer/reader. The human-facing UI over it (add-form + grid) is the next Phase-5 unit;
the API is reachable + tested now.
