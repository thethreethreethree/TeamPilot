# BUILD — three tabs, and the copy the ruling left behind

### The sub-nav the sheet draws

- write-path: `src/components/sales-coach/RepDashboardTabs.tsx` — Progress | Breakdown | Metrics,
  a WAI-ARIA tablist with arrow keys, Home/End, and roving `tabIndex`.
- write-path: **the Metrics tab is the existing Macro component, by founder decision.** The sheet
  names the tab and never draws it — four content pages, none of them Metrics — so its contents
  were not something to infer. `doorlog/TodaysMetrics` is the founder's own 2026-08-19 spec,
  already built and already rep-facing, and `TodaysMetricsPager` had paired it with the Arena under
  the labels "Progress" and "Metrics". The sheet's sub-nav was describing something that existed.
- write-path: **one panel mounted at a time.** Each board fetches on mount; rendering all three and
  hiding two with CSS would cost three requests and three spinners for a rep who opened one tab.
  Invisible in a screenshot, obvious in a network tab, and a mutation.
- write-path: the order is an argument. Where you stand, then why, then the field read. Opening on
  Breakdown puts thirty percentages in front of a rep before they have a reason to care.
- write-path: the page stays a SERVER component. Route segment config is silently ignored in a
  `"use client"` file (INVARIANT 27, which exists because that exact mistake broke `build:ci` this
  month), so the tab state lives in the client component and the page keeps its exports.
- read-path: a rep lands on Progress — the Arena plus the Pitch Score milestone strip — and moves
  between boards without scrolling past two of them.
- read-path: a keyboard user gets one tab stop, then arrow keys, with focus following the selection
  so the next Tab lands inside the panel they chose.

### The dead sentence the ruling left behind

- write-path: the board's rule line ended *"; equal totals share a place."* That explains RANKING,
  and since the 2026-09-22 ruling a rep is shown no rank — so for them it described something they
  cannot see, on a card already carrying four other lines. It is now manager-only.
- write-path: found by auditing the card's density AFTER the ruling, not by the ruling itself. A
  behaviour change removes a value; the copy that explained it stays until somebody reads the
  screen as a whole.
- read-path: a rep's rule line is now two sentences about counting, both of which apply to them. A
  manager's is unchanged.
