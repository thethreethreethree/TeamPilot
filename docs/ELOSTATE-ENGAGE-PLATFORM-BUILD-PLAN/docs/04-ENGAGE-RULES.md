# 04 — Engage rules

The code wins: `elostate-engage/src/lib/engage/flows.ts` (5 tests).

- **Delays:** the first step counts from enrolment, each later step from the one before. Hours, or business days (Mon–Fri; a weekend start moves to Monday).
- **Enrolment states:** active → (complete or skip a step) → finished after the last one. Paused ↔ active. A reply or a booked meeting finishes it. An opt-out removes it, and the contact can't be enrolled in any flow again.
- **Outcomes:** Gong's default list, each one marked connected or not and positive, neutral or negative. Connect rate = connected ÷ calls with an outcome. "Meeting booked" finishes the enrolment; "asked not to be contacted" removes it.
