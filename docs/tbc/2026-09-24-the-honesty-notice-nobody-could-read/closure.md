# CLOSURE — the sentence that exists to be honest, rendered invisible

## What is true now

`/sessions` renders correctly in all three of its branches and in both themes. The session-start
form's required field looks like a field. The ELO gauge has a track and a standard tick. And the
one line on the session-start panel whose entire job is to tell a rep what the coach cannot hear is
legible on both grounds.

## The one worth keeping

`StartSessionPanel.tsx:138` renders, when a rep picks a video session:

> On video, your mic hears **your** side — not the prospect's audio from the far end of the call.
> The coach guides your delivery: pacing, filler, framing, and the words you choose.

Its author left the reason above it: *"§3.4 honesty: … Say so plainly so the rep's mental model
matches what the coach can actually do, rather than expecting it to react to the prospect's live
words."*

It was `text-white/55`. On cream that is white on near-white. **The product's honesty notice was
invisible in light mode** — present in the DOM, absent from the screen, and absent in precisely the
situation it was written for.

Nothing failed. No test could see it. The sentence was there the whole time.

## And a correction I owe the founder

When they chose this morning's scope, the option they declined was described in my words as **"ugly,
not broken"**. I had not rendered it. On cream the four filter controls on `/sessions` and the
required field on the session-start form read as DISABLED — an inverted affordance, not an
aesthetic complaint.

**A severity estimate that has not been rendered has no business inside a picker.** That is the §5
failure aimed at the person whose decision it changes, and it is the second time today I have put a
claim in front of the founder that my own later work contradicted.

## The branch trap, third and fourth occurrence

`/sessions` is three screens; `/analytics` is two. The Expert branch holds the conversation
timeline, the session-start form and the ELO gauge, and none of the three had ever been
photographed. Standard is the default, which is why choosing it is right and why it is the trap.

Both captures now shoot every branch. The cheap defence is one grep before writing a capture:
`isStandard`, `isExpert`, `isManager`, `isOwner`.

## Residual

```json
[
  {
    "id": "R1-seven-dark-inputs-remain-with-a-corrected-severity",
    "item": "The `bg-black/30 border-white/10 text-primary` recipe survives at 7 sites: sessions/page.tsx is now clear, StartSessionPanel is clear; CoachTogglePanel (1) and TaskRefinementPanel (4) and two others remain.",
    "why_skipped": "Out of the founder's chosen scope, and four of them are in the tasks module outside Sales Coach.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:54:25Z",
    "outcome": "OPEN, with the severity CORRECTED: not 'ugly, not broken'. On cream these read as disabled controls. The founder declined a sweep on my earlier characterisation and is owed the new one."
  },
  {
    "id": "R2-46-text-white-uses-in-the-care-module",
    "item": "`CareRadialHome.tsx` (28) and `RcdMobileSheet.tsx` (18) carry `text-white/N`. Whether their grounds are fixed-dark is unknown — `CareShell`'s sidebar is, but these are separate mobile surfaces.",
    "why_skipped": "Outside Sales Coach; the founder's work today is the Sales Coach demo.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:54:25Z",
    "outcome": "OPEN, and it is the same class that produced today's highest-severity finding. Invisible body text is the worst outcome in this family and these are 46 unexamined candidates for it."
  },
  {
    "id": "R3-nine-routes-still-unrendered",
    "item": "/settings, /[id], /kpi, /training, /team, /scoreboard, /calibration, /team-chat, /door.",
    "why_skipped": "One at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:54:25Z",
    "outcome": "OPEN. /settings (1060 lines, 9 sites) and /[id] (1159, 5) are next by size. /scoreboard renders MyProgress, whose chart axis lines are `stroke-white/10` — a known member, unrendered."
  },
  {
    "id": "R4-the-text-white-gate-is-now-writable",
    "item": "Every deferral of the theme-audit widening rested on 'a gate cannot tell a fixed-dark ground from a theme-following one'. For `text-` specifically, the fixed-dark exceptions are three named shells.",
    "why_skipped": "It is a gate proposal, and gates are the founder's call on the eve of a demo.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:54:25Z",
    "outcome": "OPEN as a concrete proposal rather than a fifth deferral: flag `text-white/N` outside CareShell, SalesCoachShell and `bg-brand-shell`. 75 uses, 5 files, and the two that mattered were the two that were not shells."
  },
  {
    "id": "R5-RepActivity-never-opened",
    "item": "The manager roster's rep-detail view was never clicked into, so its session list and Save controls are unrendered. It carries three of the `border-white/15` sites fixed blind in this build.",
    "why_skipped": "One more interaction in the capture.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:54:25Z",
    "outcome": "OPEN and named because 'fixed by pattern' is a weaker claim than 'fixed and seen', and three of this build's edits are in that weaker category."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Fourteen captures plus four crops were generated from this project's own components into
`artifacts/visual/` (git-ignored). Each was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, nine Sales Coach routes, and the `RepActivity` sub-view.
