# BUILD — "View last pitch result" button after ending a Door Log session

### the Door Log offers a one-tap link to the last pitch's result after a session ends
- write-path: `DoorLog.tsx` — `justSavedPitch` state set in `save()`'s `.then` ONLY on `r.ok && !r.audioDropped`
  (a real recorded pitch, not a knock / dropped-audio); when true + `state==="idle"`, render a `<Link>` to
  `/dashboard/sales-coach/doors/report-card/latest` ("View last pitch result"), placed above the field flow so it
  never competes with Record Pitch / No Answer.
- read-path: a rep who just recorded + saved a pitch sees the optional link in IDLE and taps it to see that
  pitch's after-pitch result; a rep who logged a knock / dropped audio sees NO link (no result to view, §3.4).

### the latest-pitch link resolves to the newest pitch's detail, server-side
- write-path: `doors/report-card/latest/page.tsx` (server component) — RLS-scoped `pitches` read
  (`recorded_at desc limit 1`) → `redirect()` to `/doors/report-card/[id]`; no pitch / read error / unauth →
  `redirect()` to the Pitch Performance list (honest fallback, never a dead end).
- read-path: tapping the link lands the rep directly on their most recent pitch's full result in one hop (no
  client fetch, no loading flash); the detail page's existing "still processing" state covers a just-saved pitch.

## Files
- `src/components/sales-coach/doorlog/DoorLog.tsx` — `justSavedPitch` + the IDLE `<Link>` (imports: +Sparkles,
  +ChevronRight).
- `src/app/dashboard/sales-coach/doors/report-card/latest/page.tsx` — NEW server redirect page.
- tests: `.../latest/__tests__/page.test.ts` (NEW, 4: detail / no-pitch→list / error→list / unauth→list) +
  `doorlog/__tests__/DoorLogViewResult.render.test.tsx` (NEW, 2: appears after a real pitch save with the right
  href; absent when the save dropped to a knock).

## Pivot during build (honest record — §1.5.1 layer 1 held the line)
First cut used `useRouter` + a `GET /report-card/latest` API endpoint the button fetched on tap. Running the
targeted tests surfaced that adding `useRouter` to `DoorLog` throws "app router not mounted" in the render env —
which would have broken all 7 existing Door Log render tests (they render the real component). Rather than mock
`next/navigation` across 8 files (or globally), I pivoted to a static `<Link>` + a server REDIRECT page: no
navigation-hook dependency (zero ripple — the existing `DoorLogFlow` render test re-ran 1-of-1, no existing test
broke), simpler Door Log, cleaner UX (server redirect, no client fetch/loading), and still fully testable. The API endpoint + its
test were removed (no dead code — the redirect page replaces them).

## Ripple (holistic — §6 item 5)
- New page is additive + read-only (RLS-scoped); no schema/migration; the fire-and-forget save path is untouched
  except the one `justSavedPitch` flag.
- Static `latest` segment cannot collide with a uuid pitch id; Next matches static ahead of `[pitchId]`.
- Existing Door Log render tests unaffected (no new hook) — confirmed by re-running `DoorLogFlow`.
