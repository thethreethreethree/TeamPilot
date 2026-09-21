# BUILD

## Files

**`src/lib/coach/pitchScore/storePitchScore.ts`** — `bandFor` now returns
`BAND_LABEL[gamificationBandFor(total)]`. The four-band local copy is gone; its docblock keeps
the whole story, because the near-miss is more useful than the fix.

Scores run 0-130 (base 100 + bonus 30) and the band scale is 0-100. `bandFor` already clamps, so
a 106.5 pitch bands **Elite** — the right answer, and one the old four-band version could not
produce at any input.

**`src/lib/coach/pitchScore/__tests__/storePitchScore.test.ts`** — three tests added:

- agreement with the authority at **every half-point from 0 to 130**
- 95 and 106.5 band **Elite**
- 20 bands **"Needs coaching"**, the authority's wording

**`docs/SYSTEM UPDATES AND REVISION/LOGIC-AND-CONTRADICTIONS.md`** — section J, recording the
collision and the three-duplicates-in-one-day table.

## What changed for a rep

| Score | Before | After |
|---|---|---|
| 106.5 | Strong | **Elite** |
| 95 | Strong | **Elite** |
| 80.3 | Strong | Strong |
| 77.0 | Solid | Solid |
| 45 | Developing | Developing |
| 20 | Early | **Needs coaching** |

The middle of the range was already right. The ends were not, and the ends are where a rep is
either doing exceptionally well or needs help — the two cases the label exists for.

## The guard was measured, not asserted

Reinstating the four-band copy: **3 failed, 22 passed.**
Restored: **25 passed.**

Before the guard existed the same copy failed **zero** tests, because `bandFor(80.3)` and
`bandFor(77.0)` — the only two cases covered — fall where both versions agree.
