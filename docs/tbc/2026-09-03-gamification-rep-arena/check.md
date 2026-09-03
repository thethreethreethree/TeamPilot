# CHECK — Rep Arena

## Typecheck: `npm run typecheck` → clean.

## Lint: `npm run lint` → clean (project-wide).

## Theme: `npm run theme:audit` → 0 theme-bound leaks.

## Derivation tests: `npx vitest run src/lib/coach/gamification/__tests__/arenaSummary.test.ts` → 6 passed
gauge band from AVG + strong counts >=80; records = top-3 by points with NEW-within-7-days + band floor; bars = the
recent 7 in order; milestones flip on their thresholds; leaderboard-missing → best falls back to the rep's own max
and deals → 0 (its milestone stays off).

## Full suite: `npx vitest run` → 3994 passed | 15 skipped (was 3988 — +6 arena). Nav test still 16.

## Visual (AMD-012 — the founder specified this design)
Rendered the arena to PNG in BOTH themes and READ them:
- DARK: glowing ember radial gauge (76 / SOLID / "Best 92 · rank #1"), odometer "4,210 · Total points earned",
  stats "9/57 Strong sessions" + "9 Deals closed", Best-pitches board (Elite 92 NEW / Strong 88 80+ / Strong 84
  80+), Milestones (3 lit hexagons + 2 locked), "Last 7 sessions · points" amber bars with a zero-day gap. Faithful
  to arena-v2's structure; on ELOSTATE ink+ember.
- LIGHT: accents darken to ember-700 (#A16207) and stay legible on cream; glows removed; lit badges lightened with a
  dark-gold icon; bars readable. No low-contrast text.

## Findings
- No findings. The design mirrors the reference and reads correctly in both themes; the derivation is test-pinned;
  privacy (A18) holds (owner-scoped, links to the rep's own after-pitch).

## Not claimed
- The compact MyProgress strip on the Scoreboard is unchanged (the Arena is the full personal view; consolidating
  the two is a separate call).
- Live prod data not observed (dark/light verified via rendered mocks with realistic values + the derivation tests);
  the endpoints it reads are already live.
