# CLOSURE — my own fix was invisible too

## What is true now

`/[id]` renders correctly in both themes and both states. `[id]/page.tsx` and `PivotAndScores`
report **0** unfixed white-alpha sites, down from 9 and 7. The topic chips are visible again — on
dark as well as light, which they had briefly stopped being because of me.

## The finding

I replaced `bg-white/[0.04]` on the "Topics discussed" chips with `bg-surface`, which is the
substitution I have made roughly sixty times today. Then I rendered it.

The chips were **bare text in both themes**. `bg-surface` is `#FFFFFF` on light and ink-900 on
dark, and the card they sit on is *itself* `bg-surface`. White on white, ink-900 on ink-900.

**On dark I made it worse.** `bg-white/[0.04]` had produced a faint chip there; my token produced
none.

`bg-white/[0.0x]` never had to make that distinction, because an alpha over a parent is **one step
lighter than its parent by construction**. That is what made the idiom attractive in the first
place, and it is exactly the information a flat token throws away. `surface` is for a card on the
page; `surface-raised` is for something sitting on a card.

## Why this is the uncomfortable one

Every white-alpha fix in this session made that substitution without asking the question — the deck
kit, Analytics, Roleplay, After Pitch, Sessions, Settings, Training, DoorLog, Scoreboard. I checked
afterwards: each of those happened to be a card on a page ground, so each was right.

**None of them was right for a reason.** They were right because the pattern I was copying happened
to match the situation, which is the definition of getting away with it. One chip on one card was
enough to break it, and the only thing that caught it was rendering the thing I had just changed.

That is the second claim of mine invalidated by a later build today — the first being per-file
counts that were floors — and both were found by continuing to look rather than by re-reading what
I had written.

## And the inverse branch error

I planned an "active session" capture to render `LiveCoachingPanel`, which has never been
photographed. It is mounted **unconditionally** at `:1027`, so both captures would have been the
same picture. Every branch mistake today has run the other way — more screens than I rendered.
This one had fewer, and the fix was identical: read the condition.

## Residual

```json
[
  {
    "id": "R1-sixty-substitutions-right-by-luck",
    "item": "~60 `bg-white/[0.0x]` → `bg-surface` substitutions were made today without asking whether the element is a card on the page or a chip on a card. A spot-check of the rendered ones found them correct; the pattern-fixed-but-unrendered ones are unverified.",
    "why_skipped": "Found in this build, and re-auditing every earlier substitution is its own pass.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T03:15:07Z",
    "outcome": "OPEN, and it is the top item. A candidate scan for chip-shaped elements carrying `bg-surface` returned 62 across the codebase, but most predate today and sit on `bg-base` where the token is right. The one I traced from my own work — after-pitch:600's rename input — is in the page header on `bg-base` and correct. The honest position: one real instance found, the rest unknown, and the reasoning was absent rather than wrong."
  },
  {
    "id": "R2-three-panels-in-this-tree-unrendered",
    "item": "`SessionRecordingUpload` (3 sites), `LiveCoachingPanel` (2) and `SessionCoachTools` (1) are in this route's tree but below the captured fold or behind a state the fixture does not produce. Two panels sat at 'Loading…' because my fixture returns shapes they do not accept.",
    "why_skipped": "Each needs its own fixture shape.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T03:15:07Z",
    "outcome": "OPEN. LiveCoachingPanel is the one that matters — it runs during a live call — and it is now fixed by pattern and still unseen, which is precisely the category this session keeps promising to stop shipping."
  },
  {
    "id": "R3-remaining-sites",
    "item": "16 of the 74 closed here (9 + 7). Remaining by file: kpi/page.tsx 7, team/page.tsx 6, AddAgentDialog 6, TeamPasswordsDialog 6, VoiceEnrollment 5, LiveCoachingPanel 2, SessionRecordingUpload 3, RepSkillGrades 2, sales-coach/page.tsx 2, NotificationBell 2, RepGoalPanel 2, QuotaTargetPanel 2, plus five files with 1.",
    "why_skipped": "One route at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T03:15:07Z",
    "outcome": "OPEN. ~58 remain. `/kpi` and `/team` are the next two routes by yield."
  },
  {
    "id": "R4-the-founders-other-errors",
    "item": "Still unnamed. The backfill is fixed and pushed.",
    "why_skipped": "No evidence beyond the one screenshot.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T03:15:07Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Four captures plus six crops were generated from this project's own components into
`artifacts/visual/` (git-ignored) and each was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, three Sales Coach routes, two of DoorLog's four states, `RepActivity`, and the three panels
in this tree named in R2.
