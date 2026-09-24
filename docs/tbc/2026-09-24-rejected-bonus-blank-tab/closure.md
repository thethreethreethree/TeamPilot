# CLOSURE — the screen a manager would have opened to nothing

## What is true now

A pitch where the scorer declined a bonus, or where a manager removed one, renders. Before this
build it threw during render and the Recordings tab showed nothing at all — no list, no player, no
message.

The declined bonus appears as a grey dot labelled **Considered**, with its evidence line
(*"Heard at 0.62 confidence, under the 0.80 floor"*) and a muted `0` rather than a green one.

## Why it was live, not theoretical

`storePitchScore.ts:151` writes a `rejected_bonus` for every audio-inferred bonus under the
confidence floor. `apply_pitch_score_override` (0256:88) writes one every time a manager **removes**
a bonus — *"Demoted, never deleted."*

So the crash was reachable by two ordinary paths, one of which is a manager using the feature the
tab exists for. It has been reachable since 0254.

## The thing worth keeping from this

**Nothing in the twelve-step gate reported a problem, and the screen was blank.** `MARKER` is typed
`Record<MomentKind, …>`; indexing a Record by its own key union is always-present to TypeScript, and
correctly so — the type declared a closed key set. The data was not closed. A cast at the read
boundary is what let the two disagree, and a cast is an assertion the row cannot disprove.

Four modules carried the right three-value union. One reader asserted two. **The compiler sided with
the assertion**, because that is what an assertion is for.

It was found by rendering the component and looking at it. Nothing else in this project's twelve-step
gate could have found it, and the residual naming that gap has now been filed twenty-four times.
This is the first build where it stopped being a residual and became a defect.

## Residual

```json
[
  {
    "id": "R1-enum-audit-cannot-see-a-postgres-enum-type",
    "item": "`enum:audit` parses `check (col in (...))`. A column whose vocabulary is a `create type … as enum (…)` — like `pitch_status` (0215) — has no gate at all, so the door-log fix is held by a promise and a behavioural test rather than by a check.",
    "why_skipped": "Extending a gate inside a build about a crash would make neither reviewable.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T04:35:00Z",
    "outcome": "OPEN, and it is small and known. The schema has at least three ENUM TYPEs (`knock_outcome`, `pitch_status`, `summary_period`, all in 0215) and none of their TypeScript mirrors is gated. The parse is one more regex in a script that already walks every migration."
  },
  {
    "id": "R2-the-sweep-was-literal",
    "item": "The class sweep searched single-line `as \"a\" | \"b\"` literals. A narrowing written as a named alias, split across lines, or expressed as a `switch` with no `default` over a widened column would not appear in it.",
    "why_skipped": "The literal form is what the found instances took; the others need reading rather than grepping.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T04:35:00Z",
    "outcome": "OPEN. 20 sites were examined and 2 were real, which is a 10% hit rate on the form that IS searchable — no reason to assume the unsearchable forms are cleaner. The `switch`-with-no-`default` variant is the one that would hurt most, because it fails silently rather than throwing."
  },
  {
    "id": "R3-one-fixture-one-theme-one-width",
    "item": "The fixed surface was rendered and opened, but as one fixture, in dark theme, at 1180px, driven by mocked fetches rather than by the product against a database.",
    "why_skipped": "A real end-to-end render needs auth, a company and scored pitches.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T04:35:00Z",
    "outcome": "OPEN, and much smaller than it was this morning. The claim 'the grey Considered row renders with a muted 0' is now OBSERVED rather than inferred, which is the part that mattered. Light theme and narrow widths are unlooked-at."
  },
  {
    "id": "R4-the-real-reason-the-tab-is-empty-is-still-unfixed",
    "item": "This build makes the Recordings tab survive a rejected bonus. It does not put a single recording in it. `pitch_scores` has one writer, reachable only by a human opening one session page and pressing a button — no trigger on close, no cron, no backfill.",
    "why_skipped": "Separate build, decided and scoped: score everything in one pass, and score on session close going forward.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T04:35:00Z",
    "outcome": "OPEN AND IT IS THE ACTUAL COMPLAINT. A partner asked for the manager dashboard to show recordings and it shows none. This build is the precondition — backfilling scores onto a tab that throws would have been worse than the empty list he has now — but on its own it changes nothing he can see."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Two screenshots were generated into the scratchpad from this project's own components and both were
opened and described before any claim was made about them.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/` (the build
plan and one board were read; the other six boards were not), the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp JPEGs in that same folder, and every
surface in this project running against a real database in a real browser.
