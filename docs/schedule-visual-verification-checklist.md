# Schedule Management System — visual-verification checklist (2026-08-19 build)

> Covers the manager MVP **plus** the four founder-picker features (2026-08-19): cell-click unassign,
> manager-only visibility, replace-the-week re-import, and company timezone/workweek settings.
>
> Every schedule surface is **verified in code** (typecheck + ~230 unit/route tests, gate exit 0)
> but the automated gate **cannot render React** — so layout, contrast, z-order, and scroll-reach
> are UNVERIFIED live. This is the founder's checklist to close that one remaining gate.
>
> It is deliberately pointed at the **render-failure classes that have actually bitten this app
> before** and that only a human eye catches:
> - **Shell-clip** — a `min-h-screen` panel inside an overflow-hidden shell clips its own bottom
>   (no scrollbar appears); the last button/row is invisible and the feature looks broken. The
>   schedule pages use `flex-1 min-h-0 overflow-y-auto` to avoid this — verify the bottom is reachable.
> - **Portaled dropdown behind the shell** — a popover/menu rendering with a z-index *below* the
>   fixed app chrome, so clicking an option does nothing.
> - **Base-color / contrast collision** — text that vanishes into its background, most often in
>   **dark mode**. Check every screen in **both light and dark**.
>
> For each screen: what to do, what "correct" looks like, and what to capture if it's wrong
> (a screenshot + which step, ideally with DevTools open).

---

## 0. Access

**Do:** As a manager/admin on a **complete-access** account, open **Schedule** from the left sidebar.

**Correct:** you land on the **Roster** page with the schedule sub-nav visible (Schedule · Roster ·
Time Off · Coverage · Build · Import · **Settings**). The sub-nav does not overflow or wrap awkwardly
on a narrow window.

**Also (manager-only gate, new):** open a schedule URL as a **non-manager** (a Member-role user on the
same complete-access company). You must be **redirected to /dashboard** — a non-manager should never see
any schedule page (no flash of the grid first). A manager passes straight through.

**If wrong (no sidebar item / redirected away as a manager):** note your account's `access_module`. A
single-module pilot (care / sales_coach) is intentionally redirected away (RQ14, a founder
decision, not a bug) — tell me if this is unexpected for this account.

---

## 1. Roster — `/dashboard/schedule`

**Do:** Add a staff member (name + role). Then **inline-edit** their name. Then **Deactivate**,
then **Reactivate** them. Double-click the Add and Save buttons deliberately.

**Correct:**
- The new staff row appears immediately after Add; the form clears.
- Inline edit shows the current value, saves, and reflects the change without a full reload.
- Deactivate visibly marks the row inactive (and offers Reactivate); Reactivate restores it.
- **Double-click does NOT create a duplicate row or double-save** (guarded by a submit latch).
- All button labels and row text are legible in **dark mode** (no vanished text).

**If wrong:** screenshot the row + tell me the step. A duplicate row on double-click is the latch
failing — I need to know.

---

## 2. Build a shift — `/dashboard/schedule/new`

**Do:** Pick a date, start/end time, headcount, and select one or more staff. Try selecting someone who
already works an overlapping shift that day, or who has approved time off. Submit. Then use the
continuity buttons.

**Correct:**
- The staff **multi-select is fully visible** — if it's a dropdown, it renders **above** the form,
  not clipped behind it or behind the app chrome (z-order check).
- **Conflict warnings (new):** shortly after selecting staff (with a date + times set), anyone with a
  conflict — **double-booked**, **approved time off**, **over their weekly hours**, or **ineligible** — gets
  an **amber marker**, and a **"Conflicts (you can still create — warnings)"** list explains each. It's a
  warning, not a block: you can still create the shift (manager override). A clean selection shows no warnings.
- **Suggest who's free (new):** with a date + times set, click **"Suggest who's free"** — it lists the staff
  who can work the shift (eligible, not off/over-hours/double-booked), **least-loaded first** (with each
  person's current weekly hours), as click-to-add chips. If nobody is free it says so. (This is the plan's
  "AI proposes", reusing the same engine the time-off review uses.)
- On submit you get a success state offering **"View the schedule"** / **"Build another"** —
  clicking View takes you to the grid with the new shift shown; Build another clears the form
  (workflow continuity — you're never left at a dead end).
- The Submit button at the **bottom of the form is reachable** (scroll to it; it must not be
  clipped by the shell).

**If wrong (button off-screen / no scroll):** that's the shell-clip class — screenshot the full
window and tell me the viewport height.

---

## 3. Grid — `/dashboard/schedule/grid`

**Do:** Open the grid. Use **‹ / ›** to move week to week, then **"This week"** to jump back.
Add a shift for next week (via Build) and navigate to it. Then **click a shift cell** (someone
assigned to a shift) → confirm the "Unassign …?" prompt.

**Correct:**
- Exactly **7 day-columns** (Mon–Sun) with weekday labels + m/d dates; staff names down the left,
  the name column **stays pinned** when you scroll the grid sideways.
- Prev/Next moves by one week; "This week" returns to the current week.
- A week with no shifts shows the **"No shifts this week"** hint (not a blank void).
- **Empty shifts surfaced (new):** if a shift has no one assigned (created via Build without assigning, or
  after unassigning the last person), it shows no cells but an **amber hint** appears: "N shifts have no one
  assigned this week (not shown) — assign on Build, or see Coverage." (Without this the shift is an invisible
  ghost that Coverage still flags short.)
- **Approved time-off marked (new):** a person assigned to a shift they have **approved time off** for shows
  **struck-through + amber + "(off)"** with a tooltip — so the grid agrees with Coverage (which counts them
  absent) instead of looking falsely staffed. Overnight shifts hit by time-off on their second day are marked
  too.
- Rows show **active staff + anyone actually working that week** — a deactivated staff member with
  no shifts does **not** appear as an empty row (relevance filter).
- Cells with a shift show `HH:mm-HH:mm`; empty cells show a faint `·`. All legible in dark mode.
- **Cell-click unassign (new):** a shift cell is clickable (hover highlight); clicking it prompts
  "Unassign {name} from this shift?" — confirm and the person **disappears from that cell** on reload
  (the grid re-reads; coverage re-checks). Cancel leaves it. If the action fails, a small **dismissible
  banner** appears above the grid — the whole grid must **not** vanish to a full-screen error.

**If wrong (grid scrolls the whole page sideways / name column unpinned / a failed unassign blanks the
whole grid):** screenshot — the grid's horizontal scroll must stay inside its own container, and a
single failed action must never nuke the view.

---

## 4. Coverage — `/dashboard/schedule/coverage`

**Do:** Add a coverage requirement (headcount, optionally a time window, optionally a **per-role**
minimum). Add a second. **Remove** one. Look at the **"N shifts short right now"** section.

**Correct:**
- The requirement list updates on Add and on Remove.
- The **Per-role** input accepts a role name + count and shows it on the requirement.
- If any built/imported shift is understaffed against its floor, the **gaps section** lists it
  (with the AlertTriangle marker); if everything is covered, the section is absent or says so —
  it must not show a false gap for a fully-covered shift.

**If wrong (a covered shift shown as short, or a real gap missing):** tell me the shift's staffing
vs its requirement — the gap check should agree exactly with the time-off review.

---

## 5. Time Off — `/dashboard/schedule/timeoff`

**Do:** Pick a staff member + dates, **Evaluate**, read the impact, then **Approve** (or Deny).
Change the dates *after* evaluating but *before* deciding. Look at the **"Recorded time off"** list.

**Correct:**
- Evaluate shows the impact (coverage effect + any AI recommendation-with-why, warm/plain, **no
  em- or en-dashes**).
- **"Who could cover the gap" candidates are CLICKABLE (new):** if the time-off leaves a shift short, the
  suggested candidates each render as a button — click one and it **assigns them to cover** that shift (turns
  green, "· covering"). One click, no separate rebuild. (Closes the propose→act loop.)
- **Changing the inputs after an evaluation clears the stale result** — you cannot approve against
  an evaluation that no longer matches the form (state-bleed guard).
- Approve/Deny records and the **Recorded time off** list shows current/upcoming entries with the
  staff name and status, soonest first. A fully-past entry does not clutter the list.
- Double-clicking Approve does not double-record.

**If wrong (stale eval survives an input change):** that's the exact bug the clear-on-change guard
fixes — screenshot the form + the surviving result.

---

## 6. Import — `/dashboard/schedule/import`

**Do:** Open Import. Try the **CSV** tab with a staff×date file, and the **Schedule file
(.docx/.pdf)** tab with a VA presence-grid — pick a target week — preview — commit.

**Correct:**
- Both tabs are reachable and the active tab is visually obvious.
- CSV: extract → a mapping/preview step → commit; unrecognized shift codes are **surfaced for
  confirmation**, never silently guessed.
- VA file: after picking a file + target week, a **preview** of the dated shifts appears before
  commit; commit is atomic (a failure writes nothing).
- **Replace-the-week warning (new):** if you preview an import that overlaps shifts you already have
  in those dates, the preview shows an **amber "This replaces N existing shifts from {date} to {date}…"**
  line before the Import button — the **date range** is shown so a wrong/typo'd date is obvious. After
  importing, the success message reads **"…replaced N existing shifts."** Re-import the SAME week twice —
  the second import should **replace, not duplicate** (the shift count stays put).
- On success you're offered **"View the schedule" / "Import another"** (continuity).

**If wrong (preview omitted / no replace warning on a re-import / a re-import DOUBLES the shifts):**
screenshot the step and send the file you used (I can re-run the parser against it).

---

## 7. Settings — `/dashboard/schedule/settings` (new)

**Do:** Open the **Settings** tab. Change the **Timezone** and **"Workweek starts on"**, click **Save
settings**. Then open the **grid** and confirm it re-aligned.

**Correct:**
- The timezone dropdown lists real IANA zones; the workweek dropdown lists Sunday…Saturday.
- Save shows a **"Saved."** confirmation; reloading the page keeps your choices.
- After setting the workweek to **Sunday**, the grid's 7 columns start on **Sunday** (and "This week"
  reflects it). After changing the timezone, "today" (the current-week default, the time-off
  current/upcoming list) matches that zone near midnight.
- Legible in dark mode; the Save button is reachable (no shell-clip).

**If wrong (save silently fails / grid week doesn't realign / a non-manager can reach this page):**
screenshot + tell me the timezone/workweek you chose. A non-manager reaching Settings is a gate bug.

---

## What to send me for any failure

A screenshot of the screen + **which numbered step**, the **theme** (light/dark), and the
**viewport** (roughly — maximized desktop, half-width, phone). For a data-wrong bug (a gap that's
wrong, a label mismatch), the underlying numbers (this shift has X staff, needs Y). Render bugs
almost always fall into shell-clip, z-order, or contrast — naming which it looks like speeds the fix.
