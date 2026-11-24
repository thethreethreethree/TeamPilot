# Remote Sales — Macro Mode (the simplified system)

Source: the team's "General Sales Interface for Elostate" (3 pages, shared by the founder 2026-11-22), plus the founder's
direction the same day: "we need to create a macro mode that will have this simplified remote sales system — similar to
what we have done for the previous sales coach."

## What "similar to the previous Sales Coach" means (from the record)

Sales Coach's Macro Mode is a **per-rep switch** (`profiles.macro_mode_enabled`, migration 0219; route
`/api/coach/sales-session/macro-mode`; `MacroModeToggle`). When a rep turns it on, the home focuses on the door-to-door
surfaces and the other entries step out of the way. It is off by default and the rep can always turn it back off.

Remote Sales gets **its own** switch (the founder required Remote Sales to be fully separate from Sales Coach), with the
same shape: per-rep, reversible, and when on, Remote Sales shows only the simplified system below.

## The simplified system — the team's words, then what it maps to

"KEEP IT SIMPLE … Gong is doing too much … What would set us apart is the simplicity. No fluff."

### Every call: three tabs (Gong has six — "too many")

1. **Highlights** — Call Brief, Key Points, Next Steps; at the bottom, *generate a follow-up email / text* (and later, push
   to the company's CRM, e.g. Salesforce).
2. **Coaching** — the score (0–100), what they did well, what they need to improve. Wording chosen to motivate and
   inspire (the team cites Harvard research on the psychological effect of wording; "a way for us to boast about our
   system").
3. **Next Meeting** — set the agenda; key points to bring up next time, based on the previous meeting. A **custom
   checklist** produced when the call finishes, which **must be reviewed**; the rep can adjust, modify, keep track, and
   set reminders (calendar if needed).

Rep flow: check Highlights → check Coaching → a few days later, open Next Meeting before the second meeting for an
overview of what to say.

### Pipeline (own CRM preferred; "if this is too hard, let's just integrate to their CRM")

"Create our own CRM so they don't have to go to HubSpot then go back and open Elostate."
- Top tabs: **Open ($ total)**, **Closed Won**, **Closed Lost**.
- Per prospect: **To do** (e.g. "send a follow-up email"), **stage**, **next call date**, **last call date**,
  **potential / deal amount**. "So things don't slip through the crack" — the to-do column is the point.
- Reference: "Using Gong Engage to Manage My Pipeline // How Gong Uses Gong" (video).

### Manager flow

"Nothing will change here, except we have a section where managers can see sales reps' pipeline / sales presentation to
review it." (The team notes the call review already exists in sessions.)

> Read on 2026-11-25 (founder picker "PDF screens + team section", after "the macro system did not follow the PDF"): this
> sentence is about the manager's WORKFLOW, not their screens. With Macro Mode on, a manager sees the same simple screens
> as a rep; the "section" is "Whose pipeline" on Pipeline (a rep's pipeline, and from it their calls). Before, a manager
> kept every tab, which is why Macro Mode looked unchanged to anyone signed in as a manager.

### Daily brain dump (on first open of the day)

"Hello Moses, what is our to-do list for the day?" — the rep types their day (meetings, follow-ups). Then: "What are our
2 biggest needle movers today?" And an open-format summary of yesterday's performance.

## What already exists and is reused (not rebuilt)

- Call Brief → the factual call summary (`coach.session_summary_generated`, salesSummary).
- Next Steps → the follow-through read's callbacks (0281), which already become Tasks once a person confirms them.
- Coaching score → the call's pitch score; did-well / improve → the growth review's strengths and growth areas, which
  already follow the "strengths first, growth as opportunity" tone law.
- To-dos and reminders → the existing Tasks module (due dates), so a to-do lives in one place.
- Manager visibility → the reporting tree (0272/0273): a manager sees the pipelines of the reps under them.

## New

- The Remote Sales Macro Mode switch (own profile flag).
- Key Points, the Next Meeting agenda / key points / checklist, and the follow-up email/text draft — read from the
  transcript, every item tied to what was said.
- The pipeline: prospects with stage, amount, next call date, to-dos; last call date derived from linked calls.
  Append-only (§3.1): stage and amount changes are events; the current value is the latest event.
- The daily brain dump: what the rep wrote, the to-dos taken from it, the two needle movers, and yesterday's numbers.

## Rules the build keeps (constitution)

- **Ask first (§3.3).** Next Meeting asks the rep what they want to cover before the coach's agenda appears; their
  items lead the checklist. The AI's call outcome likewise shows only after the rep's own.
- **The rep stays the author.** Follow-ups are drafts the rep sends; the checklist becomes tasks only after review; the
  day plan only organizes what the rep wrote (an item with no word from the brain dump is dropped).
- **Nothing invented.** Key points, next steps and "bring up" items must cite a transcript line or they are dropped.
- **Append-only (§3.1).** Pipeline changes are events; the current value is the latest one.
- **Never a one-way door.** "Show the full call page" on every Macro call; the switch is always on Calls; a manager's
  tabs do not change.

## Not in the first cut (named so they are not forgotten)

- Pushing to Salesforce/HubSpot (the team's fallback; own CRM comes first).
- Calendar sync for reminders (Tasks due dates first).
