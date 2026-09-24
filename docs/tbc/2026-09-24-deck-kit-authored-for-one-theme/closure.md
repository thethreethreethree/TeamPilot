# CLOSURE — eleven surfaces of instances, one file of causes

## What is true now

Every card, ghost button, pill and meter in the Sales Coach deck kit renders correctly on both
grounds. Roleplay Practice — setup, chat and review — renders correctly on both grounds, and a rep
in light mode can read the sentence they are typing. The three dials on the rep's primary screen
have rings on cream. A count-up cannot render a negative number.

## The shape of it

Eleven surfaces were rendered before this one. On two of them this class was found and fixed
locally. On the twelfth the same defect appeared on a screen with **no page-local `white/N` at
all**, which is the fact that located the producer: `ui/deck.tsx`, 306 lines, imported by 6 files,
22 `<DeckCard>`.

I had walked past it eleven times. Each time the instance was visible and the producer was one
import away.

The thirteenth surface, `strategy/page.tsx`, is a member of this class and a grep of it returns
nothing. That is the part worth keeping: **a file can be a confirmed member of a defect class and
contain no evidence of it.** Every sweep run today counted instances at the call site. The one that
mattered was one level down.

## The inversion, which is the other half

The composer fix is the opposite of every other fix today. There the container is deliberately dark
in both themes, so `bg-black/30` and `border-white/10` are CORRECT and `text-primary` is the
defect. A rule that mechanically replaced white-alpha with tokens would have taken the one screen
where a rep cannot read their own typing and left it exactly as broken while reporting a fix.

The class name does not say which case you are in. Only the ground does, and only rendering shows
the ground.

## On the verification

The founder's chosen option required verifying every capture. That was done by shooting all 38,
stashing the change, shooting all 38 again, and hashing — 22 byte-identical, which no amount of
looking could establish. Then the instrument itself was tested by shooting twice with no change at
all: 7 of 38 differ run to run. So byte-identity is evidence and byte-difference is not, and the 16
non-identical images were opened and compared by eye.

Checking the instrument before trusting its output is the same move that separated eight phantoms
from ten real defects today. It is the only reason the 38-image claim means anything.

## Residual

```json
[
  {
    "id": "R1-strategy-one-liners-still-unrendered",
    "item": "`strategy/page.tsx` — Roleplay's sibling and the thirteenth surface — has four `<DeckCard>` and one `<DeckPill>`, so the kit fix reaches it, but it has never been photographed.",
    "why_skipped": "Its own capture and fixture; the kit change was the founder's chosen scope.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:15:06Z",
    "outcome": "OPEN, and it is the next thing. Twelve of thirteen done; the running yield is fourteen real defects, eight phantoms and three clean screens. Nothing about that rate makes the last one a formality."
  },
  {
    "id": "R2-nine-more-dark-inputs-on-light-grounds",
    "item": "The `bg-black/30 border-white/10 text-primary` input recipe survives at 9 further sites — sessions/page.tsx (2), StartSessionPanel.tsx (2), CoachTogglePanel.tsx (1), TaskRefinementPanel.tsx (4). All sit on `bg-base`, where the result is a mid-grey box rather than illegible text.",
    "why_skipped": "Out of the founder's chosen scope; four are in the tasks module, outside Sales Coach entirely.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:15:06Z",
    "outcome": "OPEN. Ugly, not broken — the severity of this class is set by the ground, and these grounds are cream. Worth a pass, not worth a demo-eve change."
  },
  {
    "id": "R3-two-unguarded-wire-casts",
    "item": "`PitchBreakdown.tsx:95` takes `body.aggregate` on trust and reads `agg.counted` unguarded; `TodaysMetrics.tsx:179` reads `data?.kpi.doorsKnocked`, where the optional chain stops one property short. Both throw THROUGH the render.",
    "why_skipped": "Both routes always send the field, so neither is reachable today. Both are latent, not live, and fixing them is not what was asked.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T09:15:06Z",
    "outcome": "OPEN and worth naming: in BOTH cases the correct pattern is within three lines. PitchBreakdown guards `skippedPreVerdict ?? 0` and `capped === true` with a comment about old servers, and leaves unguarded the one field that can throw. TodaysMetrics guards `data?.scores?.[d]` two lines above `data?.kpi.doorsKnocked`. Same shape as the Analytics ternary this morning — the right answer one branch away."
  },
  {
    "id": "R4-paleText-deferred-a-fourth-time",
    "item": "`theme-audit.mjs` still stops at `-200` and still has no category for containers.",
    "why_skipped": "Fourth deferral, and now for a BETTER reason than the first three.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:15:06Z",
    "outcome": "OPEN. The earlier reason was 'I cannot separate fixed-dark from theme-following without looking.' The composer proves the stronger form: on a fixed-dark ground the white-alpha value is CORRECT and the theme token is the bug, so a mechanical rewrite would have made the worst screen of the day worse while reporting a fix. Any gate for this class must know its ground, and the class name does not carry it."
  },
  {
    "id": "R5-the-sweeps-checked-three-properties-of-nine",
    "item": "Every `white/N` sweep today matched `border|bg|text`. `DoorDial`'s `stroke-white/15` was invisible to all of them and was found only by looking at a picture.",
    "why_skipped": "Re-running every sweep with the full property list is a pass of its own.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T09:15:06Z",
    "outcome": "OPEN, and it means the 256-site count quoted all day is an UNDERCOUNT of unknown size. `stroke`, `fill`, `divide`, `ring`, `from`, `to` and `via` were never counted."
  },
  {
    "id": "R6-the-kit-glow-branch-and-meter-unphotographed",
    "item": "No capture renders a `glow` DeckCard or a DeckMeter, so those two edits are fixed by reading rather than by seeing.",
    "why_skipped": "Neither appears on any of the thirteen surfaces' captured states.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-24T09:15:06Z",
    "outcome": "OPEN and small. Named because 'fixed by pattern' is a weaker claim than 'fixed and seen', and that distinction has been kept everywhere else today."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
38 captures plus two cropped composer strips were generated from this project's own components into
`artifacts/visual/` (git-ignored). 22 were established byte-identical to their pre-change pair;
the 16 that differed were each opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs
in that folder, and one of the thirteen Sales Coach screens.
