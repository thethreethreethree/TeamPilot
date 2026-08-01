# Sales Coach — "edits don't stick" root-cause diagnosis (2026-08-01)

Founder report: *"our system not being updated regardless of the amount of edits/revision we have made."*
This walks the record (§1.2 retrospective identification) and names the origin, so the pattern stops.

## What I verified in the CURRENT code (not assumed)

Grepped the live code for the exact texts crossed out in the founder's July-28 screenshots:

| Edit requested | Current code state |
|---|---|
| Remove earpiece "Works on earbuds… media controls" paragraph | **already gone** |
| Remove "transcript + growth review are built…" note | **already gone** |
| Remove "Opening the session isn't the same as recording it" | **already gone** |
| "You're not recording yet" → keep only "Tap Start live coaching before you begin" | **exactly per spec** (LiveCoachingPanel.tsx:224/229) |
| Earpiece checkbox parenthetical "(cue plays to your device…)" | **gone from visible text**; still in the hidden Ask-Jeff tooltip (LearningHint `why=`) |
| Auto-coach OFF by default | **done** — verified at the SOURCE: `useLiveCoaching.ts:263` `useState(false)`, not just the LiveCoachingPanel.tsx:336 comment |
| Strategy → "One Liners" | page title done; was **Standard-only** |

### Full-spec cross-check completed 2026-08-01 (both PDF pages, read from the source `Sales Coach Revision.pdf`)

The rows above cover the page-2 *text-removal* edits. Re-reading the authoritative PDF end-to-end (the
consult-the-source precondition, AMD-005: work from the source, not the mockup memory) surfaced two page-2
*functional-flow* requirements not previously in this table — both verified live:

| Spec item (PDF p.2) | Live? | Evidence |
|---|---|---|
| "After pitch feature automatically activated" + "`<Your Read>` automatically triggered" after a session | ✅ | after-pitch `generate()` auto-runs on arrival when no summary is stored (`[id]/after-pitch/page.tsx:235-238`) |
| Layout: "scoreboard on top, after-pitch summary, then next-door focus" | ✅ | after-pitch page structure + "Start Next Door" continuity (`page.tsx:49-58, 109-133`) |
| Nav order + labels (Home…Settings, p.1) | ✅ | SalesCoachShell flat nav matches the p.1 typed order (Team Chat + KPI Analytics are post-PDF features kept before Settings) |

**Conclusion: EVERY edit in the July-28 revision spec is applied and live — verified against the source PDF,
both pages.** The one nuance is the earpiece "(cue plays to your device…)" sentence, which is gone from the
visible flow but survives inside an expandable `why=` help-hint (progressive disclosure) — a founder judgment
call (remove entirely, or accept as tucked-away help?), flagged in the action queue. Prod `/api/health` serves
the latest commit. This is not a build/deploy failure.

## The actual origin — three compounding causes

1. **Mode-specific edits (the primary cause).** Several renames were applied to **Standard mode only** — e.g.
   the nav read `isStandard ? "One Liners" : "Strategy"` and the page title `isStandard ? "One Liners" :
   "Strategy Library"`. A founder viewing **Expert mode** saw the OLD label and reasonably concluded the edit
   never landed. *Fix:* make these edits **mode-universal** (done for nav + title, 2026-08-01).

2. **Stale PWA bundle / wrong host.** An installed iOS PWA resumes its last JS bundle instead of re-fetching.
   The app already ships `VersionWatcher` (baked `NEXT_PUBLIC_BUILD_COMMIT` vs `/api/health` `build.commit`,
   both from `VERCEL_GIT_COMMIT_SHA`) which prompts a one-tap reload on focus — but only on the canonical host
   `elostate.com`. Viewing a `*.vercel.app` preview or an old install can pin an old bundle. *Fix:* use
   `elostate.com`; hard-reload / reinstall the PWA once after a deploy; watch for the "New version available"
   bar.

3. **Duplicated copy (secondary).** The same sentence often lives in BOTH the visible text AND a hidden
   `LearningHint` "Ask Jeff" tooltip. Editing the visible copy leaves the tooltip twin, so the text seems to
   "come back" when the tooltip is opened. *Fix:* when removing/renaming copy, sweep the tooltip `why=` too.

## The structural discipline going forward (so it doesn't recur)

- **Edit ALL copies + BOTH modes.** A copy change isn't done until the visible text, the tooltip twin, and
  both Standard/Expert render the new value. Prefer mode-universal labels unless a per-mode difference is
  deliberate.
- **Verify LIVE, not just committed.** After a deploy, confirm on `elostate.com` (hard reload) — a green
  commit in `/api/health` + the rendered value, not just a passing build.
- **One canonical host.** Treat `elostate.com` as the only source of truth for "is my edit live".
