---
title: ELOSTATE — Landing & Pitch Page Design Elements
date: 2026-06-17
---

# ELOSTATE — Landing & Pitch Page Design Elements

A curated list of graphic and design elements that fit ELOSTATE's brand
voice and would meaningfully improve the landing (`/`) and pitch (`/pitch`)
pages. Brand context: dark theme, amber-yellow (`#FACC15`) primary, the
canonical lightbulb mark, typography-first aesthetic, constitutional
honesty (no fake social proof).

---

## 1 — Product visualization

Show what the thing actually is. Currently the landing claims "team
problem-solving engine" but the visitor can't see it.

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| Annotated dashboard screenshot | Landing hero (below the headline) | 1-2 hrs | Real screenshot of Command Center or Living Diagnosis with callouts: "the System surfaces patterns," "every event captured," "AI guidance opt-in." |
| C.A.R.E widget in-context shot | Landing or pitch (white-label section) | 1-2 hrs | Mockup of a generic customer site with the Jeff chat widget open, mid-conversation. Sells the white-label story instantly. |
| Voice mode visual | Pitch (under C.A.R.E section) | 2-3 hrs | The voice call surface with phases visible — listening / processing / speaking. Still or short loop. |
| Decision Dialogue walkthrough | Pitch (decisions section) | 3-4 hrs | A 3-4 panel sequence: situation → options → reasoning → choice. Makes the methodology concrete. |
| Coach grading screenshot | Pitch (Coach section) | 1 hr | Real screenshot of Coach grading a message with principles highlighted. |

---

## 2 — Conceptual diagrams (methodology made visible)

Where the brand differentiates. Most SaaS pages can't draw their
methodology; ELOSTATE can.

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| The event chain diagram | Pitch (architecture / how it works) | 2-3 hrs | `events → signals → problems → resolutions → (new events)` rendered as a circular flow with the bulb at center. This IS your differentiator. |
| AMD-006 four-layer pyramid | Pitch (discipline / how we build) | 2 hrs | Visual stack: structure → effectivity → composition → UI. Cite it as how the product itself is built. |
| 60-day measurement window timeline | Pitch (proof section) | 2 hrs | Horizontal timeline: Days 0-30 control (no AI), Days 31-60 intervention (AI on), Day 60 the proof. |
| The Understanding Gate diagram | Pitch (philosophy section) | 1-2 hrs | Visual of the gate: signals accumulate to threshold before a problem surfaces. A meter with the threshold marked. |
| Guide-don't-overtake illustration | Pitch (Coach + Co-pilot) | 2-3 hrs | Two-panel comparison: traditional AI (takes over) vs ELOSTATE (asks first, then suggests). |

---

## 3 — Brand pattern / texture treatments

Your brand has the bulb. Most pages use it once as the hero. There's
room to extend it as a visual language.

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| Lightbulb filament pattern (background) | Section dividers, both pages | 2-3 hrs | Stylized filament curves as low-opacity SVG backgrounds. Subtle, branded, doesn't fight the type. |
| Glow gradient transitions between sections | Both pages | 1-2 hrs | Soft amber radial gradients at section boundaries. You already have `bulb-glow`; extend the pattern. |
| Animated bulb intensity | Landing hero | 2-3 hrs | The brand bulb subtly brightens/dims on a 4-second cycle. Hint that it's "alive." |
| Grid / dot pattern overlay | Pitch section backgrounds | 1 hr | A faint grid of dots (1-2px, low opacity) — communicates "system, structured" without being heavy. |

---

## 4 — Iconography expansion

Landing and pitch currently use few icons. Room to extend.

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| Custom icon set for the modules | Pitch (per-feature sections) | 3-5 hrs | A unique mark for Decision Dialogue, Living Diagnosis, C.A.R.E — each in brand amber. Hire an illustrator OR build with SVG primitives. |
| Principle badges | Pitch (philosophy section) | 1-2 hrs | Small icon badges for each constitutional principle ("Understanding precedes solving," "Guide don't overtake"). |
| State icons for AI behavior | Pitch (how the AI works) | 1 hr | Visual marks for "listening / thinking / asking / suggesting / handing off" — brand-coloured circles in different states. |

---

## 5 — Interactive elements

The pitch is 828 lines. Interaction breaks up the read and proves the
product is real.

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| Live Coach demo | Pitch (Coach section) | 4-6 hrs | A textarea where visitors paste a draft message; Coach grades it live. Real, working demo using your existing Coach API. Massive trust signal. |
| Interactive decision dialogue | Pitch (decisions section) | 4-6 hrs | A 3-step mini-dialogue the visitor can click through to feel the methodology. |
| Before/after toggle | Pitch (proof section) | 1 hr | Toggle: "Month 1 (no AI)" → "Month 2 (AI on)" — switches between two stat displays. Don't fabricate numbers. |
| Animated scroll-driven event chain | Pitch (architecture) | 3-5 hrs | As the visitor scrolls, events visually fall through the chain. Communicates data-as-asset through motion. |

---

## 6 — Data visualization

For the §4 readout / proof story.

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| Resolution durability chart | Pitch (proof section) | 2-3 hrs | Simple chart of which fixes held vs reopened over time. Real or honest sample data. The anti-hype thesis lives here. |
| Pattern emergence visualization | Pitch (Living Diagnosis) | 3-4 hrs | Scatter / graph of individual events as dots, with patterns lighting up only after enough cluster. Shows the threshold gate visually. |
| Communication-quality trend | Pitch (Coach proof) | 2-3 hrs | Line chart: acceptance rate of suggested rewrites trending up over weeks. "Team gets better" story without a testimonial. |

---

## 7 — Trust signals (without faking them)

You don't have customer logos yet (pilot-stage). Standard SaaS plays
(logo walls, fake testimonials) would break your constitutional
honesty. Alternatives:

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| "Constitution lives in code" callout | Landing or pitch | 1 hr | Card showing a CLAUDE.md snippet with link to the public repo (if open). "Every rule we build under is in our public constitution. Audit us." |
| Amendment ledger preview | Pitch | 2 hrs | "We've made 6 constitutional amendments since launch — each documented, ratified, append-only." Link to docs/amendments/. |
| AMD-006 four-layer audit trail | Pitch (how we build) | 2 hrs | Show how each feature gets traced through the four layers before shipping. Unique to your build discipline. |
| Why no instant results | Landing (mid-page) | 1 hr | A section explicitly anti-positioning against instant-results SaaS. "We refuse to claim improvement until we've measured it." |

---

## 8 — Motion / micro-interactions

Subtle, brand-consistent.

| Element | Where | Effort | Notes |
| --- | --- | --- | --- |
| Cursor-driven bulb glow | Landing hero | 2 hrs | The bulb mark glows brighter where the cursor approaches. Tactile, on-brand. |
| Scroll-anchored stat reveals | Pitch | 2-3 hrs | Numbers count up from 0 as the visitor scrolls past them. Standard but effective. |
| Section transitions | Both pages | 2 hrs | Soft fade + amber accent line between major sections. Continuity. |

---

## Recommended starter pack — top 5 to ship first

If you want a focused first round, these 5 will change the landing's
perceived quality the most:

1. **Annotated dashboard screenshot** — replaces "trust us, it exists"
   with "look at it"
2. **Event chain diagram** — your differentiator made visual
3. **60-day timeline diagram** — explains the anti-hype thesis instantly
4. **Live Coach demo** — visitor experiences the product before signing up
5. **Glow gradient transitions** — page-wide polish that costs little

---

*Brand notes for whoever implements these:*

- Primary brand color: `#FACC15` (amber-yellow, derived from the
  lightbulb logo)
- Dark theme is the canonical look — most assets should be designed
  against the dark background
- Typography is Inter (300-900 weights)
- The canonical bulb mark is `LightbulbMark` in
  `src/components/brand/Logo.tsx`
- Existing utility classes that match the brand: `bulb-glow`,
  `shadow-glow`, `shadow-glow-ember`, `glass-card`, `text-brand`
- Constitutional honesty is a brand voice rule, not a tone preference
  — no fabricated stats, no fake testimonials, no instant-results
  claims
