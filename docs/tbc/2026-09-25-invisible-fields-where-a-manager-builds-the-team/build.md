# BUILD

### The inputs kept `bg-base`, and that was the decision

- **write-path:** `border border-white/10` → `border border-default` across both dialogs;
  `bg-white/[0.0x]` → `bg-surface-raised` by pattern; `divide-white/10` → `divide-default`.
  15 sites across the three files, plus one tint.
- **read-path:** `team`, `team-add-agent`, `team-passwords`, all in both themes.

**The fields were NOT moved to `surface-raised`, deliberately.** `bg-base` inside a `bg-surface`
modal is ink-950 inside ink-900 on DARK — a correct inset, a field that reads as sunk into the
sheet. `surface-raised` would have made it ink-800, LIGHTER than its parent, inverting the
hierarchy.

Only the edge was ever wrong. Yesterday's chip lesson was "`surface` on `surface` renders nothing";
this is its other half — **the token that fixes a light-mode symptom can break the dark-mode
intent, and the fix is whichever property was actually at fault.** Here that was the border, not
the fill.

Confirmed in the dark capture: inputs darker than the form card, card lighter than the modal, the
inset preserved.

### What the renders showed

**`team-passwords.light`, before** — the Title and Password fields as flat grey strips with no
edge, and the form card around them invisible, so three controls floated on the white sheet.

**`team-add-agent.light`, before** — the Email field the same, and the `Existing user` / `New user`
segmented control with no track: the ember active pill visible, the inactive half bare.

**After** — bordered fields inside a bordered `surface-raised` form card; the segmented control with
a visible grey track so both halves read as one toggle.

### The route

**`team.light`** — a bordered roster: Jordan Ellis (Admin), Sam Ortiz (Staff), Priya Raman and an
Unnamed member with "No access yet" pills, each row carrying a — / Staff / Admin selector with the
active one in ember; an explainer banner; and a pending-invite card for `newrep@example.com` with
Cancel.

### Where the count is

**27 across 11 files**, down from 45 and from 80 this morning. `/kpi` (7) and `VoiceEnrollment` (5)
are the only ones above 2; two of roleplay's are the deliberate `bg-brand-shell` composer.

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- salesCoachTeam  → 3 passed, 6 images
```
