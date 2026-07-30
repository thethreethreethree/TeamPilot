# CHECK — C.A.R.E "General" tab audit

Outside-view stance.

## Within-module (four layers)

- **1 structure:** reuses two existing self-contained panels + the LearningHint + Link primitives. No new
  pattern, no state, no Save, no schema.
- **2 effectivity:** the panels are the same working ones the main settings + the Sales-Coach Account tab
  render; tsc 0.
- **3 composition:** General is the first tab + first landing card; its jump-map links AI/Widget/Account so
  the whole C.A.R.E settings surface is navigable from the front door.
- **4 surface:** clear cards + the two dials; consistent with the settings design system.

## Cross-module

- **No clobber (A30):** the page renders per-user panels only; it does not fetch or PATCH tenant config, so
  it cannot collide with the Widget tab's Save. Structural, not disciplinary.
- **De-dup:** Experience Mode was on the landing; it now lives on the General tab and the landing copy +
  its import are removed (verified: tsc 0, no unused-import break).

## Class sweep (A26)

- class: a moved panel left duplicated on two surfaces. sweep: `grep -n "ExperienceModePanel" care/settings/
  page.tsx general/page.tsx` → landing has 0 refs, General has 1. No duplication.

## Findings

None. Additive, zero-risk (no tenant Save), tsc-clean.

## Inspected / not-inspected

- **Inspected:** the new page, SettingsTabs + landing card wiring, the landing Experience-block + import
  removal, that Sales-Coach already renders both panels (so its General tab is intentionally skipped), tsc.
- **NOT inspected (→ residual):** live browser render (needs an authed session); the remaining backend-heavy
  pillars (Notifications, Data & Privacy, Grading) are separate future builds.
