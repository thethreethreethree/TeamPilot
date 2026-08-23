# CLOSURE — Macro Mode bottom-nav revision

## What shipped
The founder's annotated-mockup revision of the Sales Coach **Macro Mode** mobile home:
- The Macro bottom nav is now **Home · Pitch Performance · Today's Metrics · Role Play** (4 tabs) — AI Agent + Team
  Chat removed from the macro nav, Role Play moved to the last slot, the two door-to-door DATA views promoted for
  one-tap access.
- Today's Metrics + Pitch Performance are **removed from the Macro home grid** (a true move, not a duplicate); the
  macro home is Door Log + the KPI bubbles + Start Knocking.
- The set + order + card removal are **test-locked** (this nav has flip-flopped before — A30).

Two clarifying choices went to the founder via a picker (§3.3 / AMD-013): keep-vs-drop Team Chat (chose **drop, 4
tabs**) and keep-vs-remove the home cards (chose **remove, true move**). Scope is mobile Macro Mode only — desktop
sidebar + the non-macro mobile nav are untouched.

## The un-named reliance
- The new tabs rely on the routes already existing (`/doors/report-card`, `/doors/todays-metrics`, `/roleplay`) —
  all confirmed present before wiring. The active-state logic keys on exact/`startsWith` path match; the two new
  tabs are distinct sub-routes of `/doors` and no tab points at `/doors` itself, so there is no active-state
  collision.
- The founder NAMED the nav contents, so per §1.5.4 this is layer-2 (the intended result), built + locked — not
  filed as optional polish. The one layer-4 residual is the 2-line label wrap, to eyeball at go-live.

## Residual (A36)

```json
[
  {
    "id": "macro-mobile-team-chat-unreachable",
    "item": "A mobile rep in Macro Mode no longer has Team Chat in the bottom nav (and it is not a macro home card), so Team Chat is unreachable for them on mobile while Macro Mode is on. It remains reachable on the desktop sidebar and on the NON-macro mobile nav.",
    "why_skipped": "The founder explicitly chose 'Drop Team Chat (4 tabs)' in the picker, where the option disclosed 'still reachable from the desktop sidebar' — an informed choice, not an oversight. Honoring §3.3 (the founder's decision) over unilaterally re-adding it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T10:15:00+08:00",
    "outcome": "Flagged; if door-to-door reps need Team Chat on mobile, add it back as a 5th tab or a macro home card — one-line change."
  },
  {
    "id": "macro-mobile-live-ai-coach-unreachable",
    "item": "The 'AI Agent' tab (the Live AI Coach / Sessions) was removed from the macro nav and is not a macro home card, so a mobile macro rep can't start a live AI-coached session from that surface.",
    "why_skipped": "The founder explicitly said 'Remove AI agent', and live AI-coached sessions are off the door-to-door macro flow (Door Log → pitch review → role play). Aligns with the macro focus.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T10:15:00+08:00",
    "outcome": "Flagged; intended removal — re-add only if a macro rep needs live sessions."
  },
  {
    "id": "nav-label-two-line-wrap",
    "item": "'Pitch Performance' and 'Today's Metrics' are longer than the old tab labels and wrap to two lines in the 4-tab bar; the container is items-stretch + wrapping so it renders, but those two tabs carry taller label text than Home/Role Play.",
    "why_skipped": "Layer-4 visual polish; the labels are kept verbatim to the founder's mockup (§1.5.4 — don't rename what the founder specified). Confirm on a real phone at go-live; shorten only if the founder prefers.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T10:15:00+08:00",
    "outcome": "Flagged for a go-live visual check."
  }
]
```
