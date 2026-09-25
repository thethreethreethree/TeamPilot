# CLOSURE — the sweep was the wrong shape

## What is true now

`/settings` and `/training` render correctly in both themes and in all five of their branches
(Account, Coaching, manager, rep, error). The team-brief panel has a card and its selected period
is visible.

Ten of twenty-three Sales Coach routes rendered.

## The thing worth keeping

`TeamTrainingBriefPanel` carried the same defect as everything else today and survived every sweep
for **two independent reasons**, either of which was enough:

1. **It is not in the route's file.** `/training` mounts it from elsewhere. Every sweep this
   session has been "render a route, grep that file" — so a page's children were never in scope.
2. **`bg-white/[0.03]`, not `[0.02]`.** Every fix has been an exact-string replace of the deck
   kit's string. One hundredth of an alpha step turns that into a silent no-op.

Both invalidate something I have been saying all day. **"Nine sites in `/settings`" is a count of a
FILE, and I have been reporting it as a count of a SCREEN.** And a grep for an exact string returns
a confident 0 for a file that is full of the defect.

So the per-file numbers in every closure today are floors, not totals. I do not know by how much,
and the residual says unknown rather than guessing.

## The other half

The defect inside the panel was `bg-white/10` on the SELECTED segment — Day and Week identical on
cream. That is the fifth instance of this exact shape today: the Macro Mode switch, the roleplay
persona cards, the "Solid" band chip, the leaderboard's own-row highlight, and now this.

An invisible border loses a line. **An invisible selection loses the answer to "which one is on"**,
and five instances is enough to stop treating them as the same severity.

## Residual

```json
[
  {
    "id": "R1-every-per-file-count-today-is-a-floor",
    "item": "Every sweep this session grepped the route's own file. A page's children were never included, and every fix was an exact-string replace of one alpha value.",
    "why_skipped": "The realisation came from rendering the last route, not from the sweeps.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T11:14:22Z",
    "outcome": "OPEN, and it is the most important open item. How many child components carry a white-alpha container with an alpha my replaces missed is UNKNOWN — stated as unknown rather than estimated, because an estimate from the same broken method would be worth nothing. The fix is a pattern (`bg-white/\[0\.0\d\]`) over the render tree, not a string over a file."
  },
  {
    "id": "R2-four-routes-remain",
    "item": "/[id] (1159 lines, 5 own sites), /kpi (909, 5), /team (376, 3), /team-chat, /door.",
    "why_skipped": "One at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T11:14:22Z",
    "outcome": "OPEN. And per R1, those per-file counts are floors."
  },
  {
    "id": "R3-the-learning-mode-knob-is-now-seen",
    "item": "Two builds ago `bg-secondary` was fixed at the Tailwind config and the knob was claimed fixed without being rendered.",
    "why_skipped": "Nothing — it is closed.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T11:14:22Z",
    "outcome": "CLOSED. `settings-account` shows a dark knob on a light track. A 'fixed by pattern' claim became a 'fixed and seen' one, which is the debt this session keeps promising to pay and mostly does."
  },
  {
    "id": "R4-the-founders-other-errors-are-still-unnamed",
    "item": "\"you have made several terrible errors\" — the backfill is diagnosed, fixed and pushed. The rest are unidentified.",
    "why_skipped": "I have no evidence for them and asked rather than guessed.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T11:14:22Z",
    "outcome": "OPEN. One hypothesis was raised and KILLED by checking: I thought today's Sales Coach ThemeToggle had newly exposed light mode across the product, but `Sidebar.tsx` has carried one since 2026-06-02 and `CareShell` since July. Light has been reachable app-wide for four months; my commit reached the one module that had no sidebar. A false confession would have been its own error."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Ten captures plus four crops were generated from this project's own components into
`artifacts/visual/` (git-ignored) and each was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, four Sales Coach routes, `RepActivity`, and the four checkbox surfaces fixed two builds ago.
