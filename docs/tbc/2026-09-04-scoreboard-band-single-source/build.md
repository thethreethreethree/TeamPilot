# BUILD — the Scoreboard's band chip reads the one definition

Built to the finding as found (§3.2.1). The scope is the duplicate and the crash it hid; nothing else in the
Scoreboard was touched, including the rank rendering, which belongs to a different branch and a different decision.

### The band chip on the team Scoreboard

- `src/components/sales-coach/Scoreboard.tsx` — the local `band()` that re-derived the boundaries now calls the
  shared `bandForWire`; only the colour map stays local.
- `src/lib/coach/gamification/bands.ts` — adds `bandForWire`, `bandFor` for a value that arrived over the wire.
- `src/lib/coach/gamification/__tests__/bandsSingleSource.test.ts` (new) — 9 tests.

write-path: `bands.ts` — `bandFor` rounds and clamps, and `bandForWire` coerces the PostgREST value before handing
  it over. There is no human write path to a band: it is derived from `avg_points`, which a rep sets by pitching.
read-path: `Scoreboard.tsx:124` — every row's chip, on the team board any company member can open. A manager and
  four reps read this chip about each other, which is why one of them reading a different verdict from the rest of
  the product mattered enough to fix.

```json
{
  "feature": "the band chip agrees with every other band in the product",
  "files": ["src/components/sales-coach/Scoreboard.tsx",
            "src/lib/coach/gamification/bands.ts",
            "src/lib/coach/gamification/__tests__/bandsSingleSource.test.ts"],
  "write_path": { "exists": true, "where": "bands.ts — bandFor + bandForWire", "human_can_set": true },
  "read_path": { "exists": true, "where": "Scoreboard.tsx:124, one chip per row", "human_can_see": true },
  "status": "BUILT"
}
```

## What was actually wrong

Not a duplicate that agreed. `bandFor` **rounds**; the local copy did not. `avg_points` is an average, so a rep on
**89.6** read "Elite" on their own Arena and in their weekly email, and **"Strong"** on the team board — the same
week's work, two verdicts, and no way for them to tell which was true.

## A crash found while fixing it

`bandFor(undefined)` does not return a sensible band — it **throws**. `Math.round(undefined)` is NaN, no band's
range contains NaN, and the non-null assertion on the lookup then dereferences undefined. One board row without an
average would have taken the whole Scoreboard down. The old local copy happened to survive that by falling off the
end of its `if` chain, so importing the shared function without thinking would have swapped a wrong chip for a
blank screen. `bandForWire` is where that is handled, and a test drives it.

## Two faults in my own test, both mine and both recorded

1. The source-level check fired on RepArena's **header comment**, which merely describes the rule as
   `strong sessions (>=80)`. That is a gate crying wolf on an accurate comment — the exact failure the file's own
   docstring warns about two lines further up. Comments are stripped before matching now.
2. My rounding assertion was backwards: 0.4 below a boundary rounds **up** into the band, so `not.toBe` was wrong.
   The test was wrong, not the code. It is the same mistake the Scoreboard's copy made, approached from the other
   side.

## UNTESTED

The rendered chip. The colour map is unchanged and keyed by band rather than by label, so a wrong key is now a
compile error — but nobody has looked at the board with a rep on a fractional average in it.
