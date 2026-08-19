# Schedule Management System — open-decisions brief (2026-08-19)

> Phases 1–5 + 8 are built, hardened, and audited (manager MVP + both import formats; 16 correctness
> bugs fixed; four security lenses verified clean). Every remaining item is gated on a decision that is
> genuinely yours — not something I can pick from a well-founded default without guessing product intent.
>
> This brief exists to make each decision **one read and a pick**. For each: the question, numbered
> options with a **recommendation**, the *why*, and **what building the chosen option actually entails**
> (so you're picking with the cost visible). Nothing here is built; picking is what unblocks it.
>
> Reply with, e.g., "1→b, 2→a, 3→replace-week" and I execute in that order.

---

## 1. Grid-cell editing (shift-interactivity)

**Question:** A manager can create shifts (Build / Import), view them (grid), and review time-off — but
cannot yet **edit an existing shift**: unassign a person, change its time, or cancel it. How should editing
be surfaced?

- **(a) Interactive grid** — click a shift cell → a small menu (Unassign · Retime · Cancel).
- **(b) Recommended: incremental, cell-click *unassign* only, for now** — click a cell → confirm "unassign
  {name}?" → append `EMPLOYEE_UNASSIGNED`. Defer retime/cancel.
- **(c) Separate "edit shift" form** — a shift-selector + edit form, matching the rest of the form-based UI.

**Why (b):** unassigning the wrong person is the most common real edit, the grid cell *is* the natural
selector for it (the person is shown right there), and `EMPLOYEE_UNASSIGNED` already exists in the vocabulary
+ projector + authority (coverage re-checks on unassign). Retime/cancel map awkwardly onto a per-person grid
cell (a shift with 3 people is 3 cells — "cancel the shift" from one cell is ambiguous), so they're better as
a later shift-level surface. (a) commits to a full interactive-grid pattern that breaks the form-based
consistency everywhere else; (c) needs an awkward selector because the grid already *is* the selector.

**Build scope (b):** make grid cells clickable (the pivot currently stores the shift *label* per cell; a small
change carries the `shiftId` alongside it), a confirm, a POST to the events route (`EMPLOYEE_UNASSIGNED`,
manager-gated + already supported), reload. ~half a screen of code + a route test. No new event type, no
migration.

**Cancel/retime later (needs one decision):** cancelling a shift wants a new `SHIFT_CANCELLED` event (a
tombstone, like `COVERAGE_REQ_REMOVED`) so the projector can drop it append-only. Say the word and I'll add it.

---

## 2. Org timezone + workweek start (RQ4 / RQ7)

**Question:** Two time-semantics currently use safe defaults that only *you* can make real:
- **Timezone** — "today", the grid's current week, and overnight cross-date logic use the **server/UTC**
  date. A team in a far timezone can see the week roll over at the wrong local midnight.
- **Workweek start** — the weekly-hours cap and the grid both start the week on **Monday (ISO)**. A payroll
  week that starts Sunday or Saturday would bucket hours differently.

- **(a) Recommended: add both to `companies` settings** — `companies.timezone` (IANA, e.g. `America/New_York`)
  + `companies.workweek_start` (0–6). Read them wherever "today" / week-start is computed.
- **(b) Leave the Monday/UTC defaults** — fine for a single-region, Monday-week pilot; revisit when you sign a
  team it doesn't fit.

**Why (a) eventually, (b) for now:** the defaults are correct for a US-Eastern-ish, Monday-week team, which is
likely your first customer — so this is not urgent. But it's the one thing that will *silently* mislead a team
in the wrong region (a shift shows on the wrong day), so it should be real before a multi-region customer.

**Build scope (a):** a migration adding two `companies` columns (defaults UTC + 1=Monday), a settings reader,
and threading it through `localTodayIso` / `weekStartOf` / the overnight coverage check. Unblocks the overnight
coverage-side nuance too (see the drift-guard note in `evalContext.ts`). Medium — touches a few time helpers.

---

## 3. Re-import semantics

**Question:** Importing the same week twice currently **appends** — a re-uploaded correction creates duplicate
shifts rather than replacing the old ones.

- **(a) Recommended: replace-the-week** — on import, first cancel/supersede existing shifts in the imported
  date range, then add the new ones. Matches the mental model ("here's the corrected week").
- **(b) Add** — always append (current behavior); the manager cleans up duplicates by hand.
- **(c) Skip-duplicates** — a shift whose (date, times, staff) already exists is skipped.

**Why (a):** a re-import is almost always a *correction*, and the manager expects the new file to win. (c)
silently drops a legitimately-changed shift that happens to collide; (b) is the current duplicate-generating
behavior.

**Build scope (a):** the import already runs through the atomic `apply_schedule_import` RPC — extend it to
supersede shifts in the target date range within the same transaction. Needs the `SHIFT_CANCELLED` tombstone
from decision 1 (so superseding stays append-only). Medium.

---

## 4. Legacy `.xlsx` schedules

**Question:** CSV import is built. A manager with a staff×date **Excel** schedule can't upload it directly
(they'd export to CSV first). Add native `.xlsx`?

- **(a) Recommended: stay CSV-first for the pilot** — "export your sheet as CSV" is one step, and it avoids a
  heavy dependency (`xlsx` / SheetJS) with its own CVE history on your prod build.
- **(b) Add `xlsx`** — accept `.xlsx` directly; nicer for a non-technical manager.

**Why (a):** the VA presence-grid (.docx/.pdf), which *is* your real format, is already handled; generic Excel
is a convenience, and the dependency cost + supply-chain surface isn't worth it until a customer actually needs
it. Trivially revisited.

**Build scope (b):** add the dep, an xlsx→grid extractor feeding the existing CSV import pipeline (planner +
preview + atomic commit are reused). Small-to-medium, but adds a dependency to vet.

---

## 5. Schedule entitlement / positioning (RQ14)

**Question:** The schedule is positioned as a standalone tool, but access is currently gated by the 0207 module
hard-lock to **complete/elostate** accounts: a single-module pilot (`access_module = care | sales_coach`) is
redirected away. This is the lock working as designed, not a bug — but the entitlement is an accidental side
effect, not a deliberate SKU.

- **(a) Recommended: bundle with complete-access (leave as-is)** — schedule is part of the full product; no
  change. Correct if you're not selling scheduling standalone yet.
- **(b) Make it its own module** — `access_module = 'schedule'` + a path-allow for locked accounts, so a
  scheduling-only customer can buy just this.

**Why (a) unless you have a standalone buyer:** (b) is real work (a new module value + entitlement wiring +
pricing) that only pays off if you're actually selling scheduling on its own. Default to (a); pick (b) when a
scheduling-only lead appears.

**Build scope (b):** a new `access_module` value, `moduleAccess.ts` path-allow, a nav/entitlement pass, and a
pricing line. Medium, and it's a go-to-market decision as much as a code one.

---

## 6. Non-manager schedule visibility (RQ23)

**Question:** Schedule **writes** are manager-only (enforced server-side), but **reads** are member-visible and
there's no page-layout `isAdmin` gate — so a Member-role user in a complete-access company can open every
schedule page: they see the data (writes 403 on click, which is broken UX). Note the data includes **sick**
time-off, which may be sensitive.

- **(a) Recommended: manager-only** — a `layout.tsx` redirect for non-`isAdmin`. Simplest, and it sidesteps the
  sick-leave-visibility privacy question entirely until staff self-service (Phase 6) is designed.
- **(b) View-all, read-only for non-managers** — keep reads visible but hide the write actions (a clean
  read-only view). Choose this only if you *want* colleagues to see the schedule.

**Why (a):** staff have no accounts yet (Phase 6 deferred), so the only non-manager who can reach these pages is
an admin's colleague — and there's no product reason yet for them to see everyone's shifts and sick days.
Manager-only is both the safer privacy default and the simpler fix. (b) is right later, per-person ("your
schedule"), which is a Phase-6 design, not a company-wide read-all.

**Build scope (a):** one `layout.tsx` under `dashboard/schedule` redirecting non-`isAdmin`. Small. Data is not
at risk either way (writes are already gated) — this is UX + privacy posture.

---

## 7. Time-off approval → unassign?

**Question:** When a manager **approves** time-off for someone already assigned to a shift in that range, should
the system **auto-unassign** them (leaving a gap to fill), or keep them assigned but **exclude them from
coverage** (the current model, RQ15)?

- **(a) Recommended: keep-assigned + exclude-from-coverage (current)** — the shift still shows the person with
  a visible "on approved time off" state, and the coverage-gap view flags it as short. Nothing is silently
  dropped.
- **(b) Auto-unassign** — approval removes them from the shift, leaving an empty slot.

**Why (a):** it preserves the record (who *was* scheduled before the time-off) and makes the gap visible
without erasing history, which fits the event-sourced, nothing-discarded model. (b) is cleaner-looking but
loses the "was assigned, then took leave" story and can surprise a manager (someone vanished from a shift).
The coverage-gap view already surfaces the resulting shortfall, so (a) loses nothing operationally.

**Build scope:** (a) is already the behavior — **no work**, this is a confirm-the-default. (b) would append an
`EMPLOYEE_UNASSIGNED` on approval; small, but I'd want your confirmation because it changes recorded history
shape.

---

## Fastest path to value

If you want the most-used gaps closed first, the highest-leverage sequence is **1(b) → 7(confirm a) → 3(a)**:
cell-click unassign, confirm the time-off model, then replace-on-reimport — together they give a manager full
create/view/**edit**/re-import over a real week. 3(a) and shift-cancel both want the `SHIFT_CANCELLED`
tombstone, so deciding 1's cancel-later question unlocks both. Everything else (2, 4, 5, 6) is
posture/go-to-market and can wait for the customer that forces it.
