# BUILD — Analytics merged into the Coach Assessment card

### scoresOnly mode (cost)
- write-path: `skills/route.ts` — `?scoresOnly=1` returns the deterministic six scores + band read via
  `mergeBreakdowns(skills, new Map())`, skipping the LLM breakdown pass.
- read-path: the card can fetch every rep's scores cheaply; the full AI breakdowns remain on the rep's Analytics self-view.

### Skill scores on the card (§1.5.1 layer 2 + honest states)
- write-path: `coach-assessment/page.tsx` — a lazy `SkillGrades` component (mounts inside the expanded block; fetches
  `/skills?agentId=&scoresOnly=1` per rep on expand) renders the six graded scores under Doing Well / Coaching Focus.
- read-path: a manager sees each rep's skill scores ON the assessment card — no separate Analytics trip. Honest states
  for loading / error / not-enough-sessions.

### Nav: Analytics rep-only (§1.5.1 layer 3)
- write-path: `managerNav.ts` — new `repOnly` flag hides an item from MANAGERS (inverse of managerOnly).
  `SalesCoachShell.tsx` — `NavItem` gains `repOnly`; "Analytics" is `repOnly: true`.
- read-path: managers see Coach Assessment (analytics merged), no separate Analytics; reps keep their own Analytics —
  neither role is stranded.

## Files
- `src/app/api/coach/sales-session/skills/route.ts` — scoresOnly
- `src/app/dashboard/sales-coach/coach-assessment/page.tsx` — SkillGrades on the card
- `src/lib/nav/managerNav.ts` (+ test) — repOnly rule
- `src/components/sales-coach/SalesCoachShell.tsx` — NavItem.repOnly + Analytics repOnly
- `src/components/sales-coach/__tests__/salesCoachShellNav.test.ts` — order drift-guard bound relaxed for the new comment

## Ripple (§6 item 5)
`repOnly` is additive to the shared nav filter (managerOnly path unchanged; both product shells use the helper — the
CareShell nav has no repOnly items, so it's unaffected). `scoresOnly` is a new optional param — every existing
`/skills` caller (the rep self-view, the analytics manager drill-in) is unchanged (full breakdowns by default). The
mobile tab bar keeps "Analytics" for everyone — mobile is the rep-centric surface and the founder's ask was the
desktop manager dashboard; a manager on mobile still reaches their own analytics there.

## Honest limit
The `SkillGrades` render + the actual per-rep skill display over live data are founder visual-verify (jsdom can't
exercise the lazy fetch UI). The scoresOnly route change + the repOnly nav rule are unit-gated; typecheck + the full
gate cover the wiring.
