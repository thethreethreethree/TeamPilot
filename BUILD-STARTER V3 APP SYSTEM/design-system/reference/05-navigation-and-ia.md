# Navigation and information architecture

The strongest evidence in this system. Treat it as the least negotiable.

## Visible navigation

`[STRONG]` — 179 participants, 6 sites, three conditions:

| Metric | Hidden | Visible / combo |
|---|---|---|
| Navigation used, large screen | 27% | 48–50% |
| Navigation used, phone | 57% | 86% (persistent + overflow) |
| Time to access navigation | 5–7s slower | baseline |
| Content discoverability | **>20% worse** | baseline |
| Task time | **≥39% slower** | baseline |
| Perceived difficulty | +21% vs visible | baseline |

The finding transfers directly to apps: **primary destinations belong in a
persistent, visible tab bar, not behind a hamburger/drawer.** A drawer as the
*only* navigation reproduces the hidden-nav penalty above. On phone, the "visible
+ overflow" pattern — a few tabs plus a labelled "More" — is the app equivalent
of the combo condition that won.

Contrast and labelling matter as much as visibility. In the same study a
low-contrast hamburger got 17% usage against a 42% average, while a high-contrast
labelled button scored highest. Tab items carry both an icon **and** a label —
icon-only bars measurably hurt recognition.

## The app navigation model

Two structures do almost all the work; learn where each belongs.

- **Tab bar (bottom) — parallel top-level sections.** 3–5 co-equal destinations
  the user switches between freely. Each tab owns its **own** navigation stack,
  so switching tabs and coming back preserves where you were.
- **Stack — drill-down within a section.** Push a screen to go deeper, pop (or
  back-swipe) to return. This is the hierarchy.

Built with **expo-router** (file-based) or **React Navigation** directly (verify
current for APIs). A modal presentation is a third mode — for a self-contained,
interrupting task (compose, a picker) — not a place to park a destination.

Do not invent a novel shell. The tab-bar-plus-stack model is what users already
know; spend your distinctiveness on surface, not on relearning how to get around.

## Bottom tab bar

Bottom-anchored primary navigation is reachable across grips and matches both
platforms' conventions. **3–5 destinations. Cap at 5** — beyond that, targets
and labels cannot stay adequate, and the choice stops being scannable.

- If you have more than 5 top-level areas, the 5th tab is a "More" list, not a
  6th tab.
- Every tab: icon **plus** short label, a clear selected state (not colour
  alone), and it returns to that section's root on re-tap of the active tab.
- Keep it above the home indicator (safe-area inset); never let content hide
  behind it.

Grip is highly variable: one-handed 49% (right thumb 67% of those), cradled 36%,
two-handed 15%. **No single grip reaches half of use**, so design for grip-
independence rather than optimising for one. A bottom bar is reachable in more
grips than a top bar; the most frequent action can also surface as a reachable
primary control rather than a top-corner one.

**Do not use the coloured thumb-zone heatmap.** Its author retracted it in 2017:
*"people touch the center of the screen. More, more quickly, more accurately, and
by preference. Not the corners or edges."* The Fitts's-Law corner argument is
desktop-mouse-specific — it depends on the pointer clamping at screen edges,
which does not exist on touch.

## Breadth vs depth

`[MODERATE]` — depth costs more than breadth. Each level multiplies decision
points and the cost of a wrong turn: a bad choice near the top means backing out
through everything below it. Two-level structures beat three-level at equal node
count — and on a phone every extra level is another full-screen push to unwind.

**But shape is second-order. Label quality dominates.** Category-name
distinctiveness matters most at the top level. This is **information scent** — the
better-supported framework, and the one to lead with. A deeper hierarchy with
excellent scent beats a shallow one with ambiguous labels.

Practical: **2–3 levels**, **3–5 tabs**, and where a section needs breadth, a
grouped list beats a wide flat one. Recent work favours a "concave" shape — broad
at the top, narrower in the middle, broader at the leaves.

**Do not justify counts with "Miller's 7±2".** Miller measured recall of items
held *without external support* and called the number "a pernicious, Pythagorean
coincidence". A visible tab bar or on-screen list externalises the memory
entirely. The limit was later revised to ~4 anyway.

## Menu selection is linear, not logarithmic

`[STRONG]` — for a menu or list a user has **never seen**, selection time is
linear in item count:

```
novice (visual search):  T = 0.08n + 0.30 s
expert (memorised):      T = 0.08·log₂(n) + 0.24 s
```

The model predicted observed performance within 2% across four menu designs. So
"Hick's Law means fewer items are faster" is directionally right for the wrong
reason, and understates the **magnitude**: every extra item in an unfamiliar list
costs a first-time user about 80ms of search.

Hick's Law also does not apply to choices requiring *evaluation* — product
lists, pricing tiers, content feeds. Do not reach for "choice overload" there
either: a meta-analysis of 50 studies found a mean effect indistinguishable from
zero.

## Information scent

The construct that actually predicts findability. Users follow the label whose
words smell most like their goal.

- Front-load the information-carrying word. "Pricing", not "Our Pricing".
- Avoid invented brand vocabulary in navigation. "Solutions" and "Platform" are
  scentless — and a tab label has almost no room to recover from a bad guess.
- Labels should predict what is behind them precisely enough that a wrong tap is
  rare — a wrong first choice roughly halves task success.

## Every screen is an entry point

Deep links, universal / app links, push notifications, widgets and share sheets
all drop the user **mid-hierarchy** with no run-up. Every screen must orient on
its own. Orientation mechanisms worth having:

1. A clear screen **title** in the header.
2. Current tab marked with **real** visual prominence — most apps signal the
   active tab too subtly.
3. A visible, reliable **back** affordance (and a sensible destination if the
   user arrived cold via a link — a link into a leaf should still let them move
   *up* into the app, not dead-end).
4. Section-level visual differentiation so a screen feels like it belongs
   somewhere.
5. Contextual cues — dates, status, breadcrum-in-title where a path matters.

**The test, worth adopting verbatim:** open a screen cold, as a deep link would,
and ask *"where am I in this app, and how do I get out?"* Designer familiarity
systematically hides how weak these signals are.

## Back and up

On a phone, **back** carries most of the load that breadcrumbs carry on the web,
and users expect it to always work.

- The header back button and the **OS back gesture** (iOS edge-swipe, Android
  predictive back / system gesture) must both be honoured. Let the navigator own
  them — a custom transition that swallows the back gesture breaks a reflex.
- Distinguish **back** (undo the last navigation) from **up** (move to the parent
  in the hierarchy) only when they genuinely differ — e.g. arriving via a deep
  link. Give an explicit "up" path there so a cold arrival is not trapped.
- Do not stack modals or push endlessly deep; a user who cannot see how to get
  back is lost. Full breadcrumb trails are a large-screen pattern — on a phone,
  put the parent in the title, not a wrapping trail.

## Headers

The native stack header is the app's orientation bar. Use it, do not reinvent it.

- Title names the current screen; keep leading (back) and trailing (primary
  action) slots for their conventional jobs. iOS large titles and Android's app
  bar are the expected shapes.
- A collapsing / hiding-on-scroll header reclaims scarce vertical space on long
  screens — reasonable, but not a default, and it must not hide a control the
  user needs.
- Keep header actions few and labelled or clearly iconographic; the header is not
  a place to hide primary navigation.

## Disclosure and grouped lists

The web mega-menu has no place here. When a section has many items, the mobile
patterns are: a **sectioned/grouped list**, an expandable row, or a further
**stack push** — recognition over recall still wins (all options visible in a
grouped list beats a remembered path), but on one screen at a time.

- Chunk long lists into labelled groups; order by workflow or frequency; no
  duplicates.
- Avoid deeply nested inline accordions — a push to a new screen is usually
  clearer than a third level of expand-in-place.

## Search and filters

Search is an expectation, not a bonus — success rose from 64% (2000) to 92%
(2017) as ranking and placement standardised. Modern behaviour is **hybrid**:
search to enter a category, then browse and filter within it. Do not cite "half
of users are search-dominant" — a late-1990s figure.

**Faceted navigation** `[MODERATE-STRONG]`, phone-adapted:
- The **filter tray / bottom sheet with an explicit "Apply"** outperformed both
  inline-expand and a separate screen in testing — use it.
- Applied filters stay visible and individually removable (chips above the
  results).
- Category-specific facets (screen size for TVs) beat generic ones.
- Show result counts.

## Methods

- **Card sorting** — *generative*, before you have an IA. Tells you how people
  group things. Does **not** tell you whether they can find things.
- **Tree testing** — *evaluative*, after. Text-only hierarchy, no search, no
  visual design. Measures success, directness and first-tap correctness.

Correct sequence: card sort → draft IA → **tree test** → iterate → build →
usability test on device. Skipping the tree test is the common failure, because
grouping intuitions and finding behaviour diverge.
