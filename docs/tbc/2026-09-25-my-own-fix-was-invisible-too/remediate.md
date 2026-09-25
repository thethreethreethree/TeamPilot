# REMEDIATE

### `bg-surface` on a `bg-surface` card

gate-or-promise: promise, and it is the sharpest one of the session

**The promise: before substituting a white-alpha fill, ask what the element is SITTING ON.**

- A card on the page ground → `bg-surface`.
- A chip, a cell, an inset, a nested panel ON a card → `bg-surface-raised`.

`bg-white/[0.0x]` never had to make that distinction, because an alpha over a parent is always one
step lighter than its parent **by construction**. That is the whole reason the idiom was
attractive, and it is why the mechanical substitution to a flat token loses information the
original encoded.

**The tell, and it is cheap:** a token fill that equals its parent's fill renders nothing. Read the
parent's class before replacing the child's.

### And the harder half: this invalidates work already shipped

Every `bg-white/[0.0x]` → `bg-surface` substitution in this session has been made without asking
that question — the deck kit, Analytics, Roleplay, After Pitch, Sessions, Settings, Training,
DoorLog. Each happened to be a card on a page ground, so each was right; **none of them was right
for a reason.**

The ones I rendered are confirmed by their pictures. The ones fixed by pattern and not rendered are
not, and they are named in the residual rather than assumed correct.

**This is the second time today a claim of mine has been invalidated by a later build** — the first
being per-file counts that were floors. Both were found by continuing to look rather than by
re-reading what I had written, which is the argument for the render pass over the audit.

### Three alphas of one intent in one file

gate-or-promise: promise

`PivotAndScores` carries `[0.01]`, `[0.02]` and `[0.04]`. Fixed by pattern in one pass.

**The promise is unchanged and now has a second instance behind it:** match `bg-white/\[0\.0\d\]`,
never one literal. `TeamTrainingBriefPanel` taught this two builds ago with a single `[0.03]`; this
file would have needed three separate exact-string edits and would have reported clean after any
one of them.

### Assuming two branches where there was one

gate-or-promise: promise

`LiveCoachingPanel` is unconditional, so an "active" capture would have duplicated the "ended" one.

Every branch lesson today has run the other way — a component with more screens than I rendered.
**This is the same error inverted**, and it has the same fix: read the condition. One grep either
way.
