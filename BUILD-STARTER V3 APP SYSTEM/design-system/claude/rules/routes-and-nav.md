---
paths:
  - "app/**/_layout.tsx"
  - "app/**/index.tsx"
  - "app/**/*.tsx"
  - "src/app/**/*.tsx"
  - "**/nav*.tsx"
  - "**/*header*.tsx"
  - "**/*tabbar*.tsx"
---

# Navigation and screen rules

Findability is the highest-leverage thing on this list. The evidence here is
stronger than for anything aesthetic.

## Visible navigation is not a style choice

NN/g, 179 participants, 6 sites, three conditions:

| Metric | Hidden nav | Visible / combo |
|---|---|---|
| Navigation used, large screen | 27% | 48–50% |
| Navigation used, phone | 57% | 86% (persistent + overflow) |
| Content discoverability | **>20% worse** | baseline |
| Task time | **≥39% slower** | baseline |
| Perceived difficulty | +21% | baseline |

The finding transfers directly to apps. **Primary destinations belong in a
persistent, visible tab bar — not behind a hamburger/drawer.**

**Rules:**

- Primary navigation is a **bottom tab bar of 3–5 co-equal destinations**. A
  drawer as the *only* navigation reproduces the hidden-nav penalty above.
- Every tab carries an **icon and a label** — icon-only bars measurably hurt
  recognition — and a clear selected state that is not colour alone.
- If you have more than 5 top-level areas, the 5th tab is a labelled "More"
  list, not a 6th tab. Contrast and labelling matter as much as visibility: a
  low-contrast trigger tested at 17% usage against a 42% average.
- Keep the bar above the home indicator (safe-area inset); never let content
  hide behind it.

## The app navigation model

Two structures do almost all the work; learn where each belongs.

- **Tab bar (bottom) — parallel top-level sections.** 3–5 destinations the user
  switches between freely. Each tab owns its **own** stack, so switching away and
  back preserves where you were.
- **Stack — drill-down within a section.** Push a screen to go deeper, pop (or
  back-swipe) to return. This is the hierarchy.
- **Modal** — a third mode, for a self-contained, interrupting task (compose, a
  picker) — never a place to park a destination.

Built with **expo-router** (file-based routing under `app/`) — router and hook
shapes are version-specific **(verify current)**. Do not invent a novel shell:
the tab-bar-plus-stack model is what users already know. Spend your
distinctiveness on surface, not on relearning how to get around.

## Structure

Aim for **2–3 levels** and **3–5 tabs**. Depth costs more than breadth: a wrong
turn near the top means backing out through everything beneath it — and on a
phone every extra level is another full-screen push to unwind.

But shape is the second-order variable. **Label quality dominates.** A deeper
hierarchy with excellent information scent beats a shallow one with vague labels.
Front-load the information-carrying word; avoid invented brand vocabulary in tab
and header labels — a tab label has almost no room to recover from a bad guess.

> Do **not** justify item counts with "Miller's 7±2". Miller measured recall of
> items held in memory *without* external support and called the number "a
> pernicious, Pythagorean coincidence". A visible tab bar externalises the memory
> entirely. Cap navigation width because of scanning cost and reachable targets,
> not because of a misread 1956 paper.

## Every screen is an entry point

Deep links, universal / app links, push notifications, widgets and share sheets
all drop the user **mid-hierarchy** with no run-up. Every screen must orient on
its own:

1. A clear screen **title** in the header.
2. The current tab marked with **real** visual prominence — not a 5% opacity
   shift. Most apps signal the active tab too subtly.
3. A visible, reliable **back** affordance — and if the user arrived cold via a
   link into a leaf, an "up" path into the app so they do not dead-end.
4. Section-level visual differentiation so a screen feels like it belongs
   somewhere.
5. Contextual cues — dates, status, a path-in-title where the path matters.

**The test, worth adopting verbatim:** open a screen cold, as a deep link would,
and ask *"where am I in this app, and how do I get out?"* Designer familiarity
systematically hides how weak these signals are.

## Back and up

On a phone, **back** carries most of the load that breadcrumbs carry on the web,
and users expect it to always work.

- Honour both the header back button **and** the OS back gesture (iOS
  edge-swipe, Android predictive back / system gesture). Let the navigator own
  them — a custom transition that swallows the back gesture breaks a reflex.
- Distinguish **back** (undo the last navigation) from **up** (move to the parent
  in the hierarchy) only when they genuinely differ — e.g. arriving via a deep
  link. Give an explicit "up" path there.
- Do not stack modals or push endlessly deep. Full breadcrumb trails are a
  large-screen pattern — on a phone, put the parent in the title, not a wrapping
  trail.

## Headers

The native stack header is the app's orientation bar. Use it, do not reinvent it.

- Title names the current screen; keep the leading (back) and trailing (primary
  action) slots for their conventional jobs. iOS large titles and Android's app
  bar are the expected shapes.
- A collapsing / hiding-on-scroll header reclaims scarce vertical space on long
  screens — reasonable, but not a default, and it must not hide a control the
  user needs. Ensure a focused element is never obscured behind it.
- Keep header actions few and labelled or clearly iconographic; the header is not
  a place to hide primary navigation.

## Menus and disclosure

The web mega-menu has no place here. When a section has many items, the mobile
patterns are a **sectioned/grouped list**, an expandable row, or a further
**stack push** — recognition over recall still wins, but on one screen at a time.

- Chunk long lists into labelled groups; order by workflow or frequency; no
  duplicates across groups.
- Avoid deeply nested inline accordions — a push to a new screen is usually
  clearer than a third level of expand-in-place.
- A **bottom sheet** is the app equivalent of a disclosure panel for a focused
  set of choices or a filter tray.

## Above the first screen

Attention concentrates at the top of a scroll, but scrolling is expected — the
job is prioritisation, not cramming.

- Put the value proposition and primary entry points in the first screenful.
- Do not cram everything above the first fold. That rule is dead on phones too.
- Let the next section peek above the fold so it is clear there is more to
  scroll — a full-bleed first screen that looks self-contained stops people
  scrolling.

## Deep links and metadata

Every route should be reachable and describable, because links, notifications
and the OS share sheet all target routes directly.

- Register the app's URL scheme / universal links and give each route a stable,
  readable path under `app/` (expo-router derives routes from the file tree).
- Set per-screen options — the title, header and presentation — on the route
  (`Stack.Screen` options / the route's exported config). Handle an unknown
  route with a real "not found" screen, not a blank stack.
- For links that should render a preview outside the app (share sheets, OG
  cards on a companion web page), supply the metadata there — inside the app the
  equivalent is a correct screen title and a sensible cold-start destination.
