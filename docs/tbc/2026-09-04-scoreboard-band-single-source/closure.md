# CLOSURE — the Scoreboard's band chip reads the one definition

## What shipped

The team Scoreboard's band chip now comes from `bands.ts` rather than from a copy of the boundaries kept beside it.
The copy did not round, and the value it classified is an average — so a rep on **89.6** read "Elite" on their own
Arena and in their weekly email, and **"Strong"** on the board their whole team looks at.

Fixing it surfaced a second defect: `bandFor(undefined)` **throws**, and one board row without an average would
have taken the whole Scoreboard down once it was wired to the shared function. `bandForWire` handles the wire's
two realities — numeric arrives as a string, and a value can be absent — and a test asserts that `bandFor` still
throws, so the reason the wrapper exists cannot be inlined away by a later reader.

## Checks — commands, not moods (§3.2.3 / A38)

The canonical gate `npm run check` is pasted in check.md with its exit code. Nine new tests where the chip had
none; six mutations, six CAUGHT — one of which was MISSED on its first run and led directly to finding the crash.

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  617 passed | 1 skipped (618)
      Tests  4058 passed | 15 skipped (4073)
exit: 0
```

## The un-named reliance

- Relies on `avg_points` remaining the value the chip bands. If the board ever showed a band for the TOTAL instead,
  the rounding would still be right but the meaning would not.
- Relies on `BANDS` covering 0–100 with no gap, which `bandFor`'s non-null assertion depends on and `rubric.test.ts`
  pins.
- The source-level duplication check names three files by path. A fourth surface that renders a band would not be
  covered until it is added to that list — stated plainly because a check whose scope is a hand-written list is
  only as complete as the list.

## Residual (§4 / A36 — read from the top of the confidence ranking)

```json
[
  {
    "id": "R-2026-09-04-07",
    "item": "Other callers of bandFor that could be handed an undefined value from a wire payload, as the Scoreboard nearly was.",
    "why_skipped": "Felt contained: the crash was found in one component and fixed there, and every other caller looked like scoring code holding a real number.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T06:22:00+08:00",
    "outcome": "Opened BECAUSE the confidence was high, which is A36's rule, and it was worth the read. Every remaining caller of bandFor in the web repo takes its number from a computation rather than from a payload — rubric.ts and points.ts re-export from bands.ts and band values they have just calculated, and the digest uses STRONG_SESSION_THRESHOLD rather than bandFor at all. The render surfaces are the only ones fed straight from the wire, and they are the ones now going through bandForWire. Confirmed rather than assumed: no second crash of this shape is waiting."
  },
  {
    "id": "R-2026-09-04-08",
    "item": "The rendered chip on a running board with a rep on a fractional average.",
    "why_skipped": "No live data with a fractional average on demand, and the colour map is unchanged.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  },
  {
    "id": "R-2026-09-04-09",
    "item": "Whether the MOBILE app's own band module has drifted from the web's in some way the mirror tests do not cover.",
    "why_skipped": "The app's points.ts mirrors the server's BANDS and its own tests pin the boundaries; a full value-by-value comparison across the two repos was not run.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-04T06:25:00+08:00",
    "outcome": "Opened anyway, because it was two file reads. No drift: the app's BANDS carry the identical five ranges (90/80/60/40/0) and the identical five labels, it rounds with Math.round before classifying, and it clamps past either end. There is ONE deliberate difference and it is documented where it lives — the app's bandFor returns null for an absent value where the web's throws, on the reasoning that a rep with no scored session has not been judged badly, they have not been judged. That is the better behaviour of the two, and it is what bandForWire now gives the web as well."
  }
]
```

## For the owner

Branch `scoreboard-band-single-source`, off `main`, nothing merged. It is independent of the other two branches and
can be reviewed on its own.
