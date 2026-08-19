# Schedule System - operator guide

How a manager or admin runs the schedule system. This is usage documentation (the build record lives in
`BUILD_MANIFEST.md`; findings in `docs/audits/2026-08-19-schedule-*`). It is a **standalone tool** - staff are
plain roster records, no Elostate account required.

Everything here is **manager-only** (role CEO/COO/admin). Nothing writes until you press the action button,
and the underlying data is **append-only** (corrections are new events, never edits - the full history stays
intact for later analysis).

---

## The screens (`/dashboard/schedule`)

| Screen | What it does |
|--------|--------------|
| **Roster** | Add / list staff (name, role, skills, certifications, weekly-hours min/max, status). |
| **Grid** | The week at a glance - staff × dates, each cell the shift that person works that day. |
| **Coverage** | Define how many people (and which roles) a shift needs - the floor the system checks against. |
| **Time off** | Review a time-off request: the system shows the coverage impact + candidate replacements, and the AI drafts a recommendation. You approve or deny - it never auto-decides. |
| **Import** | Bring an existing schedule in from a file (two formats - below). |

---

## Importing a schedule

There are two input shapes, on two tabs of the Import screen. Both end in a **preview → Import** step; nothing
is written until you confirm, and an unreadable code/block **blocks** the import (never a silent or guessed shift).

### 1. CSV grid - staff × dates

Staff down the side, dates across the top, a shift code in each cell (e.g. `6-3`, `OFF`).

1. Paste the CSV.
2. The AI **proposes** the ISO date for each column and the meaning of each shift code - you **confirm or edit**.
3. Preview shows the staff / shifts / days-off counts and any code still needing a mapping.
4. Import.

### 2. Schedule file (`.docx` / `.pdf`) - a time-block × staff "On Duty" grid

This is the shape of the VA weekly schedule: **time-blocks down the side** (`5 AM - 8 AM`, `10 AM - 12 PM`, …),
**staff across the top**, and **"On Duty"** in a cell when that person works that block. It reads as a recurring
**weekday** template (Mon-Fri), not specific dates.

1. **Upload** the `.docx` or `.pdf`.
2. **Pick a target week** (any day in it - the Monday is used). The recurring template is applied to Mon-Fri of
   that week.
3. **Preview** - the server reads the grid, **coalesces each person's contiguous On-Duty blocks into shifts**
   (e.g. On-Duty 10-12 *and* 12-1 becomes one 10:00-13:00 shift; overnight runs like 11 PM-2 AM + 2-3 AM become
   one 23:00-03:00 shift), and applies them across the week. It shows the staff count, the number of dated shift
   assignments, and any time-block it **couldn't read** (fix those in the file before importing).
4. **Import** - creates any new staff and the dated shifts, all in one atomic step (if anything fails, nothing is
   written).

**`.docx` is the reliable source.** A Word file states the meridiem on both sides of every block
(`10 AM - 12 PM`), so there's no ambiguity. A PDF often writes the shorthand `10-12 PM`, which is inherently
ambiguous; the system reads PDFs by the on-page position of each mark, but if you have both, prefer the `.docx`.

---

## How the AI helps (and where it stops)

The AI is **advisory only**. On import it *proposes* date and code mappings for you to confirm. On a time-off
review it *drafts* a recommendation with its reasoning. It never computes the actual approve/deny decision -
that is a deterministic gate over your coverage rules, and it always stands regardless of what the AI says.

The gate blocks, as **hard** conflicts, only what is physically true: an ineligible person (missing role/skill),
someone booked on an **overlapping** shift at the same time (a non-overlapping split shift is fine), someone
scheduled during **approved** time off (including an overnight shift that runs into an off day), or someone over
their weekly-hours cap (counted **per week**, not all-time). A coverage shortfall is a **soft** block - flagged,
but you can override it.

---

## Known limits / open decisions

These are surfaced so an operator isn't surprised; each awaits a product decision (see `BUILD_MANIFEST.md`).

- **Re-importing** the same schedule appends duplicate shifts (import-once is assumed). If you re-upload a
  correction, remove the earlier import's shifts first. A proper re-import semantic (replace vs add) is pending.
- **Time zone** is not yet a per-company setting; shift times are compared as clock times. Correct within a
  single time zone; cross-time-zone scheduling needs the setting (RQ4).
- **Workweek start** is Monday (ISO). A Sunday/Saturday payroll week needs a setting (RQ7).
- **Employee self-service** (staff viewing their own schedule / requesting time off) is not built - a manager
  records on their behalf for now.
