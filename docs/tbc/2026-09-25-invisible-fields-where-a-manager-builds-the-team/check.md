# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- salesCoachTeam  → 3 passed, 6 images
$ npm run check                     → see closure
```

## It was looked at

**`team-add-agent.light`, before** — a white modal on a grey overlay: "Add agent" with a close X;
an ember "Existing user" pill beside a bare "New user" with **no track around either**; "Email"
over a **flat grey strip with no border**; the note "They already have an Elostate / Sales Coach
account — they're added to the team right away."; "Sales Coach access" with None / Staff / Admin
(these DO have borders); and an ember "Add to team".

**`team-add-agent.light`, after** — the segmented control sits in a grey bordered track, so both
halves read as one toggle; the Email field has an edge.

**`team-add-agent.dark`** — the same, with the track a step above the modal and the field sunk
below it.

**`team-passwords.light`, before** — "Team passwords" over its explanation, then a **borderless
Title strip** and a **borderless Password strip** beside an ember "+ Create", the hint "At least 8
characters…", and "No team passwords yet — create one above." The form card containing them was
invisible.

**`team-passwords.light`, after** — both fields bordered, inside a bordered `surface-raised` card.

**`team-passwords.dark`, after** — fields DARKER than the card, card lighter than the modal. The
inset hierarchy the `bg-base` decision was protecting.

**`team.light` / `.dark`** — the roster described in build.md, correct in both.

## Findings

### Borderless input fields in the two dialogs a manager sets the team up with

class: `border-white/10` on a control inside a `bg-surface` modal
sweep: render-tree → `AddAgentDialog` 5, `TeamPasswordsDialog` 5, both now 0
severity: high — a field that does not look like a field is a control a person does not know they can use

**[OBSERVED]** Three inputs across the two dialogs rendered as flat grey strips on cream.

**[OBSERVED]** The same inputs are correct on dark, where `bg-base` inside `bg-surface` is a
visible inset regardless of the border.

### The unselected half of a segmented control disappearing

class: white-alpha as the TRACK of a two-state control
sweep: `AddAgentDialog:78`
severity: medium

**[OBSERVED]** Only the ember active pill was visible; "New user" had nothing around it.

**Sixth instance of this shape today**, after the Macro Mode switch, the roleplay persona cards,
the Scoreboard "Solid" chip, the leaderboard's own-row highlight and the team-brief Day/Week
segment. The pattern is stable enough to state as a rule: **a two-state control needs its track in
a token, because the selected state is always the one that survives.**

### Three section cards on the page

class: the session's standing class
**[OBSERVED]** Fixed, and visible in the after capture as a bordered roster and a bordered
invite card.

## What this does not prove

**27 sites remain across 11 files.** `/kpi` (7) and `VoiceEnrollment` (5) are the only ones above
two.

**The dialogs' populated states were not captured** — `team-passwords` was shot with "No team
passwords yet", so the password ROWS (with their copy and delete controls) are unrendered, and
`AddAgentDialog`'s "New user" tab, which carries a third input, was not switched to.

**`/kpi`, `/team-chat` and `/door` are still unrendered routes.**
