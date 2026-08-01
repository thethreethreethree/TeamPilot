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
| Auto-coach OFF by default | **done** (LiveCoachingPanel.tsx:336) |
| Strategy → "One Liners" | page title done; was **Standard-only** |

**Conclusion: the edits were made and are deployed.** Prod `/api/health` serves the latest commit
(`82f64f01`). This is not a build/deploy failure.

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
