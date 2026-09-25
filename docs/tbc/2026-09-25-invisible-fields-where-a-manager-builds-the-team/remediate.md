# REMEDIATE

### The token that fixes light can break dark

gate-or-promise: promise, and it is the other half of yesterday's chip lesson

Yesterday: `bg-surface` on a `bg-surface` card renders nothing. Today: `bg-base` on these inputs
looked wrong on cream and was RIGHT on dark, where it is the inset that makes a field read as sunk
into the sheet. Moving it to `surface-raised` would have fixed a light symptom by inverting a dark
intent.

**The promise: fix the property that is actually at fault.** Here the fill was doing real work in
one theme and the BORDER was invisible in the other, so only the border changed. The reflex — see
white-alpha, substitute the nearest token — treats a class string as one decision when it is
several.

Three related rules now, from three consecutive builds:

- `surface` for a card on the page, `surface-raised` for a thing on a card;
- an alpha over a parent is one step lighter **by construction**, which is the information a flat
  token discards;
- and a fill that is correct in one theme is not evidence that the fill is the defect.

### A two-state control whose track is white-alpha

gate-or-promise: promise — sixth instance, so it is now a rule rather than an observation

Macro Mode's switch, the roleplay persona cards, the Scoreboard "Solid" chip, the leaderboard's
own-row highlight, the team-brief Day/Week segment, and this.

**The rule: a two-state control needs its TRACK in a token.** The selected state is always the one
that survives — it is the one with an accent colour — so the failure never looks like a broken
control. It looks like emphasis on the one that works, which is why six of these have shipped and
why I walked past several while looking straight at them.

### Capturing a modal through its trigger

gate-or-promise: promise

Both dialogs were rendered directly with `open`, not by clicking the page's buttons.

**The promise: a component gated on a prop is captured by setting the prop.** Driving the UI to
reach it adds the trigger's state to the fixture's surface area and buys nothing — and if the
trigger is what breaks, the capture reports the wrong component. Same reasoning as mocking
`useLiveCoaching` at its return shape.

### And the matcher, again

`/password/i` matched the heading, a placeholder and a button title at once. Replaced with
`/^Team passwords$/i`.

Not a new lesson — the ninth instance of the same one — but worth the line, because the failure
mode this time was **ambiguity rather than vacuity**: the matcher named the state correctly and
still could not identify a single node. "Exists only in this state" is necessary; "identifies one
element" is also necessary.
