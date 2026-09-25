# CHECK — the last 23 Sales Coach suspects, triaged by ground

## Triage (each line read, not counted)

**9 correct, not defects** — 2 are comments (MobileHomePager:80, MacroModeToggle:47, prose about earlier
fixes); 5 are already split behind `dark:` (PivotAndScores:198, Scoreboard:63, after-pitch:1075/1078/1086);
2 sit on the fixed-dark roleplay composer, `bg-brand-shell` (roleplay:517/541).

**14 real, fixed:** 6 `hover:bg-white/5` → `hover:bg-surface-raised`; MeetingReview:190 chip →
`bg-surface-raised`; RepGoalPanel:73 and QuotaTargetPanel:73 cards → `border-default bg-surface` (both sit
in a plain column on the Settings page ground); RepSkillGrades ×2 dividers → `border-default`;
ScoringRubricSheet:192 → `divide-default`; SalesCoachComing:20 → `bg-surface`; TodaysMetricsPager:157
unselected tab → `bg-surface` (the seventh two-state control today whose unselected half vanished).

## Looked at

**[OBSERVED]** todays-metrics light/dark — Breakdown and Metrics now in pills in both themes. The photo also
showed the SELECTED "Progress" pill as white on bright yellow in BOTH themes; the Metrics page's own "Day"
pill uses near-black on the same yellow. Matched: `text-[#09090B]`. Re-shot, readable in both.

**[OBSERVED]** settings-coaching light/dark — Monthly quota and Daily sales goal now have the card every
other panel on the tab has; nothing lost in dark.

## Fixed by pattern, unseen

RepSkillGrades dividers (re-rendered, not re-opened, and not confirmed reached by the analytics capture);
MeetingReview chip, ScoringRubricSheet dividers, SalesCoachComing (no capture); six hover states (a still
image cannot show hover).

## Where Sales Coach stands

Every `(bg|border|divide)-white/` match in Sales Coach has now been read: the shell's 9 and roleplay's 2
are correct on fixed-dark grounds, 5 are correctly split, 2 are comments. **No theme-following white-alpha
site remains.**

Gate: CHECK_EXIT=0, 5,530 passed, invariant violations 0.

## Not opened

No image, icon, logo, favicon or graphic asset was touched. Not opened: the analytics captures re-rendered
in this pass.
