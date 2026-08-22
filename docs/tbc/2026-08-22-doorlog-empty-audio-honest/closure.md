# CLOSURE — Empty/silent pitch audio fails honestly (audit H1)

## What shipped
Closed reliability-audit finding H1: the pitch worker no longer marks an empty/silent/0-byte recording
`complete` with a fabricated analysis + made-up scores. Three honest terminal guards — 0-byte audio, empty STT
transcript (before writing/analyzing), and a defense-in-depth empty read-back transcript — so a captured-nothing
pitch fails honestly ("No audio was captured" / "No speech was detected") and is surfaced as a failed pitch,
distinct from an empty history. Worker-only; no client/route/schema change. Full `npm run check` exit 0.

## The un-named reliance
- The "no speech" floor is a plain empty-string check. A recording with a tiny amount of noise-transcribed text
  could still pass; if false-positive silent-but-noisy analyses appear, a word-count floor (>N words) is the
  next lever. Not needed on the evidence today.

## Residual (A36)

```json
[
  {
    "id": "word-count-floor-not-added",
    "item": "The guard fails on an EMPTY transcript but not on a near-empty one (1-2 stray words from background noise).",
    "why_skipped": "Empty is the observed failure mode; a word-count floor risks failing genuinely short-but-real pitches. Add only if noise-fabricated analyses are seen.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T07:58:00+08:00",
    "outcome": "Deferred; empty-string guard covers the observed H1 case."
  }
]
```
