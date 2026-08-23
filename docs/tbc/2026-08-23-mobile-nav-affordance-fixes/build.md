# BUILD — mobile back-nav affordance (F1/F2) + label de-collision (F3)

### a systemic mobile "← Back" on every SC TopBar page (F1/F2)
- write-path: `TopBar.tsx` gains `showSalesCoachBack = inSalesCoach && pathname !== "/dashboard/sales-coach"` →
  a mobile-only `router.back()` button (same tap-target/styling as the hamburger it replaces on SC routes). The
  back button and the hamburger are mutually exclusive (SC vs non-SC); non-SC routes are byte-unchanged.
- read-path: a rep on Roleplay / One Liners / any SC TopBar page reached from a home card now has an in-page way
  back (previously only a lit-tab-less bottom bar); the SC home shows no back (it renders no TopBar on mobile, and
  the exact-path guard belts it).

### "Pitch Performance" is no longer two destinations (F3)
- write-path: the non-macro home card `title="Pitch Performance"` → `"Pitch Analytics"` (it opens /analytics).
- read-path: "Pitch Performance" now uniquely means the macro report-card tab (/doors/report-card); the non-macro
  card name matches the Analytics screen it opens. The collision (one label → two pages) is gone.

## Files
- `src/components/layout/TopBar.tsx` — systemic SC mobile back button (F1/F2).
- `src/app/dashboard/sales-coach/page.tsx` — non-macro card rename (F3).
- tests: `layout/__tests__/TopBar.render.test.tsx` (NEW, +3: back on non-tab SC / hidden on home / hamburger on
  non-SC + router.back() called), `macroCardVisibility.render.test.tsx` (updated: macro-OFF asserts "Pitch
  Analytics" present + "Pitch Performance" absent as a non-macro card).

## Ripple (holistic)
- TopBar is a SHARED component. The change is scoped to SC routes (`inSalesCoach`) + mobile (`md:hidden`); non-SC
  pages keep their hamburger unchanged. Confirmed no other test renders the real TopBar unmocked (schedule layout
  doesn't use it; page tests mock it out), so the added `useRouter` can't break the suite. router.back() is
  standard history-back; the rare empty-history case (deep-link) is bounded by the ever-present bottom nav.
- SCOPE: Door Log (no TopBar) is NOT covered by this single systemic fix; the Home tab already returns a macro rep
  there, so it is flagged as a minor follow-up (residual), not a dead-end. No route/schema/data change.
