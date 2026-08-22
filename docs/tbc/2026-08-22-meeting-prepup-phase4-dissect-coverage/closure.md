# CLOSURE — Prep-up Phase 4: Dissect agenda coverage

## What shipped
The post-meeting Dissect now measures the meeting against its Prep-up agenda: did it hit the GOAL (yes/partial/no
+ a note) and which must-discuss TOPICS were covered vs missed — judged over the FULL diarized transcript (§3.5
consequence, never the coach's cues). Stored in the dissect event payload + shown as an "Agenda coverage" section
in the Meeting Review (goal-attainment pill + covered/missed checklist). Reuses the existing dissect pipeline +
the Phase-1 prep data; `parseMeetingDissect` unchanged (agenda parse is a separate helper). Prep-less meetings
are byte-unchanged. Full `npm run check` exit 0.

**With this, Prep-up is functionally COMPLETE (Phases 1-5):** collect (goal/topics/docs + OCR) → agenda-aware
live coaching (hints/drift/uncovered-alert + coverage tracking) → connected flow → agenda-scored review.

## The un-named reliance
- **Live/go-live confirmation.** The goal-attainment + coverage judgments are unit-tested with a fake LLM; a
  real prepped meeting's review is confirmed at go-live (post-migration). Migrations 0237 + 0238 must be applied
  (founder db:apply) for any of Prep-up to persist.
- **Coverage re-assessed at dissect time** over the full transcript (authoritative), independent of the live
  window-accumulated coverage — so a topic missed by the live tracker is still correctly judged here.

## Residual (A36)

```json
[
  {
    "id": "prepup-complete-go-live-pending",
    "item": "Prep-up (Ph1-5) is complete but not live to users: migrations 0237 + 0238 (founder db:apply) + global nav/module-gating + device test remain (go-live track).",
    "why_skipped": "Go-live is the founder-gated step (migrations + the 'first-3' wire-up + device validation); the feature is built + reachable by URL.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T14:00:00+08:00",
    "outcome": "Prep-up feature-complete; go-live is the next, founder-gated milestone."
  },
  {
    "id": "old-cached-dissects-lack-agenda",
    "item": "Dissect events generated before this phase have no `agenda` in their payload.",
    "why_skipped": "Agenda coverage only applies to prepped meetings; pre-Prep-up meetings had no agenda to measure. A ?force=1 re-run regenerates with the agenda if the meeting was later prepped.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T14:00:00+08:00",
    "outcome": "Expected; the review omits the section when agenda is absent."
  }
]
```
