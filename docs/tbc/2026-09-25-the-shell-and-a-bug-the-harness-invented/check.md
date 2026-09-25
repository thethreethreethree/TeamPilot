# CHECK — the Sales Coach shell, and a layout bug the harness invented

## Commands

```
$ npm run visual -- salesCoachShell   → 2 passed, 4 images, each opened and described
$ npm run check                       → see closure
```

## The shell had never been photographed

`SalesCoachShell` frames every Sales Coach page and held the largest white-alpha count left (9). No
capture had ever rendered it.

**[OBSERVED, source]** All 9 sit inside `bg-brand-shell` — the desktop `<aside>` (:315) and the
mobile `<nav>` (:467). `brand-shell` is a fixed hex, `#0B1620` (tailwind.config.ts:57), not a theme
variable.

**[OBSERVED, render]** shell-desktop.light — navy sidebar on an off-white page; yellow logo, "Sales
Coach", Home, MANAGER DASHBOARD with Coach Assessment in a visible `bg-white/10` active pill, Score
Calibration, "Pattern Interr…" beside a NEW badge, the `border-white/10` guide line, TEAM TOOLS, the
bottom divider over "Back to ELOSTATE". shell-desktop.dark — identical sidebar against a near-black
page, separated by its faint right edge.

**Verdict: the 9 are correct.** White alpha on a ground that is dark in both themes. Sales Coach's
real remaining count is 37 − 9 = **28**.

Cosmetic, not colour: at the sidebar's fixed width the NEW badge truncates "Pattern Interrupt" to
"Pattern Interr…". A label/badge decision, left for the founder.

## The clipped tab that was not

**[OBSERVED]** The first shell-mobile.light showed the bottom nav with its fifth tab cut off at the
right edge — only "Ac" visible. On the width reps use at the door, that would have been serious.

**[OBSERVED]** It was the harness. The shell's root is `fixed inset-0`. A fixed element sizes to the
BROWSER WINDOW, not to the shooter's `#vp` box, and escapes its `overflow:hidden`. Tab spacing in the
PNG was ~97.5px, i.e. the nav laid out at ~488px — wider even than the 430px window.
**[INFERRED]** headless Chrome clamps its window to a minimum width, so the layout viewport was wider
than the screenshot, and the PNG cropped it.

**[INFERRED, arithmetic]** On a real 390px phone: five `flex-1` tabs × 78px; the widest label ("Team
Chat", 10px) needs ~46px. They fit.

Fix, in the harness: `transform: translateZ(0)` on `#vp`, which makes it the containing block for
`position:fixed` descendants — what a phone does, where the viewport IS the page's box.

**[OBSERVED]** Re-shot: the nav ends exactly at 390px with the 40px slack visible beside it; Home,
Analytics, Sessions, Team Chat, Account all whole, in both themes.

This is the failure the harness's own header describes ("a harness whose failure mode is INVENTING
layout bugs is worse than no harness"), arriving by a second route. The first was a subtree lifted
out of its flex chain; this one is a fixed element escaping the frame.

## Did the broken frame produce any finding I already reported?

Only captures narrower than Chrome's minimum window, whose tree uses `position:fixed`, were exposed.
**[OBSERVED]** The narrow captures are after-pitch (430), live-coaching (448), pitch-performance (390)
and shell-mobile (390). after-pitch/page.tsx, PitchPerformance.tsx and LiveCoachingPanel.tsx contain
no fixed-positioned element. **Only shell-mobile was affected, and it was caught before being
reported.** The "live control row wraps every label to three lines at 448px" finding stands.

## Not opened

No image, icon, logo, favicon or graphic asset was touched. The yellow mortarboard mark in the sidebar
is rendered by the shell from an icon component and was described from the render, not edited.
