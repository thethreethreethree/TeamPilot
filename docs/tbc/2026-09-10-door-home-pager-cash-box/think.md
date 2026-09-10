---
started_at: 2026-09-10T08:30:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — door home screen: swipeable pager + cash box (match the founder's mockup)

## Why (the record)
The founder pointed at their own "Door Tracker Screen" artifact (claude.ai) and said "I want this exact same
user interface and graphics" and "make it swipeable" — and could not find the built screen "in our system".
Diagnosis from the record: the door screen was shipped as a URL-only preview (`/dashboard/sales-coach/door`);
a grep for `/door` across `src/**/*.tsx` returned zero nav links, so nothing reachable pointed at it. This is
the LAST increment of the phased build — the pager — plus bringing the screen to exact parity with the mockup.

## Understanding
The mockup (read in full, raw HTML) is: date eyebrow → "Afternoon, Marcus" → "Today's door target" sentence →
three 26-tick dials (doors/presentations/sold, done-of-target) → "Tap a dial to log one" → an "Earned today $"
cash box → two pager dots + "Swipe left…". Two founder calls settled the deltas from the earlier build via
picker: the bottom box is the mockup's CASH box (needs a manager-set $-per-sale), and the accent stays the app's
ember — which is `--ember-400: #FACC15`, byte-identical to the mockup's yellow-400, so "keep ember" and "match
the yellow" are the same colour. The app's whole dark theme (bg #09090B, borders #27272A/#3F3F46, text
#FAFAFA/#A1A1AA/#71717A) already equals the mockup's zinc palette — so parity is largely by construction.

One constraint held (§1.5's "interrogate locked doors"): the prototype's tap does a fake +1 and has "Reset the
day". Real counts are immutable logged events (a door_knock needs an OUTCOME; a presentation is a recorded
pitch), so the dials show REAL counts and a tap OPENS the quick-log; the reset button is omitted. Showing
fabricated counts would break §3.4 — that is the one thing not copied, and it is a correctness floor, flagged.

The user specified the experience (exact UI + graphics), so under §1.5.4 the visual parity is layer-2 (the
intended result), not deferrable polish — hence the render-check in check.md.

## Ripple (§1.5)
- Touches the LIVE mobile home (`page.tsx`): when Macro Mode is ON the mobile home becomes the two-page pager
  (page 0 door, page 1 the original Macro home). When OFF or still loading, the existing home is unchanged.
- The 3 all-time door bubbles are REMOVED from page 1 (founder decision) — page 0 owns the funnel numbers now;
  the now-dead `macroTotals` state + its `door-log?range=all` fetch are removed with them.
- New column `sale_value_cents` on `rep_daily_sales_goal` (migration 0248). Read via `select("*")` (not a named
  projection) so a pre-0248 DB does not error (A34); the cash box degrades to "sales to goal" until it lands.
  The write path retries without the column if it is absent, so setting a goal still works pre-migration.
- Home bottom-tab → page 0 via a window event (Next.js won't remount the page when Home is tapped on the home
  route), mirroring the existing `elostate:macro-mode` event pattern in the shell.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Understanding precedes solving — diagnose why the screen was unreachable before building.",
    "how_this_build_will_embody_it": "Grepped for /door nav links (zero) and read the mockup in full before writing the pager." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-44", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Governing docs in-tree; hashes pinned in front-matter." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "60-72", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Interrogate locked doors; trace ripple before committing.",
    "how_this_build_will_embody_it": "The fake-+1/reset constraint is respected (real logged data), and the live-home ripple is traced above." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Layer-2 effectivity + layer-3 continuity — a reachable, swipeable screen that flows.",
    "how_this_build_will_embody_it": "The pager makes the screen reachable; swipe + Home-tab + dots keep the rep in a flowing state." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "THINK first, then confirm.",
    "how_this_build_will_embody_it": "The horizontal-vs-vertical scroll conflict was designed for up front (scroll-snap x on the track, y inside each page)." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "174-205", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "A user-specified experience is layer-2, not waivable polish.",
    "how_this_build_will_embody_it": "The founder specified exact UI/graphics; visual parity is treated as the result and render-checked in check.md." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-380", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "No fabrication — real numbers, honest empty states.",
    "how_this_build_will_embody_it": "Dials show REAL logged counts; no manager $-per-sale → the cash box degrades to sales-to-goal, never a fake $0." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-448", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Founder decisions via picker; a prod migration applies on the founder's word.",
    "how_this_build_will_embody_it": "The cash-box and accent deltas went through pickers; 0248 is BUILT but not applied (founder applies via db:apply)." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Cited ranges opened this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Cited clauses read in-session.",
    "how_this_build_will_embody_it": "Each entry carries an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "The $-per-sale flow-through + pager reset are pinned by tests." },
  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "872-890", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "Migration-coupled code keeps a guarded fallback; never assert the migration is applied.",
    "how_this_build_will_embody_it": "sale_value_cents is read via select(*) and written with a retry-without-column, so the app works before 0248 lands." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-10T08:31:00+08:00",
    "why_it_governs": "'Verified' names the command actually run.",
    "how_this_build_will_embody_it": "check.md pastes the gate output + exit code and the targeted suite result." }
]
```
