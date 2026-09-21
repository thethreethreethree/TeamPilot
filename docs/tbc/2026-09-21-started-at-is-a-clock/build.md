# BUILD

Four features. The first is the task; the other three are what writing its record turned up.

### Breakdown truncation notice

The last of three routes over `readPitchPeriod` to truncate silently, and the one that truncated
soonest — it passed no limit, so its bound was the 500 default rather than the 900 the other two
use. Its section averages were computed over part of a period with nothing on screen saying so.

- **write-path:** `src/app/api/coach/sales-session/pitch-score/breakdown/route.ts` passes
  `limit: 900` to `readPitchPeriod` and returns `capped: read.capped` — the verdict the read
  already computed, not a re-derivation from `rows.length` (§2.2; the previous build shipped
  `read.pitches.length >= 900`, which copied both the constant and the wrong array).
- **read-path:** `PitchBreakdown.tsx` threads `capped` through the wire type, component state and
  `Board` props, and renders an amber notice above the board: *"This period has more pitches than
  one read returns, so these averages cover only part of it. A shorter period will be complete."*
  Three render tests cover warns-when-capped, silent-when-not, and silent-when-an-older-server-
  sends-no-verdict.

### Build selection compares instants, not strings

`pickLatestBuildName` keyed on `` `1:${started}` `` and sorted with `localeCompare` — a text sort
over raw front-matter. `2026-09-22T09:30:00+08:00` and `2026-09-22T02:00:00Z` are 30 minutes apart
and the string sort puts them in the wrong order. The comment asserted "an ISO instant, so it
orders builds by real time"; an ISO string orders by real time only when every record shares one
offset. This is the 2026-08-13 lexicographic bug one layer down — the fix inherited the defect it
was written to remove, and no test caught it because every existing case used `Z`.

- **write-path:** `scripts/tbc/lib.mjs::pickLatestBuildName` parses with `Date.parse` and compares
  numerically; an unparseable value is treated as absent rather than as a large string.
- **read-path:** `scripts/tbc/__tests__/pickLatestBuild.test.ts` — a `+08:00` entry that means an
  earlier moment than a `Z` entry must lose. Six new cases, and the tier that separates "real
  timestamp" from "no timestamp" is pinned by a transposed-year case (`0202-09-21`) found by
  mutation, since below the epoch a real instant sorts negative.

### A build that has not started cannot be the build in progress

Two changes, because one of them expires.

- **write-path:** *(the demotion)* in `pickLatestBuildName`, a `started_at` later than `now` drops to
  the name tier, where it can only win if no real build exists. This removes the *pressure* — an
  honest clock reading now outranks a future-dated predecessor, so a new record no longer has to
  out-declare the last one to be seen.
- **write-path:** *(the durable half)* `currentBuildDir` excludes any dir named in the
  `tbc:freshness` allowlist. The demotion alone is time-relative: the 2026-09-21 overshoot records
  declare 19:30, 21:00, 23:00 and 09:30-tomorrow, so they stop being "future" one by one through
  the evening and reclaim the selection from an honest build committed at 18:20. The allowlist is
  already the single place recording which starts are not clock readings, so the selection consumes
  that verdict instead of forming its own (§2.2).
- **read-path:** `node -e "import('./scripts/tbc/lib.mjs').then(m=>console.log(m.currentBuildDir()))"`
  returns `docs/tbc/2026-09-21-pitch-score-persistence` — the single honest record of the 26 written
  today — and will return this build's dir once it is committed.

### The gate: started_at is measured against the commit that shipped the record

A30's terminal step. The sort fix removes the incentive; nothing yet fails when an author writes a
time the session had not reached.

- **write-path:** `checkStartTimes` in `scripts/tbc/verify-freshness.mjs` runs on every build dir
  appearing in the staged diff or the committed range. For each, it compares `started_at` against
  the commit that *added* that `think.md` — clock-free, so a false record does not become true
  overnight — falling back to `now` only for a dir with no commit yet. Five minutes of grace absorbs
  rounded starts. 153 historical dirs are allowlisted by name, each with its measured overshoot and
  which of the two causes it is.
- **read-path:** `npm run tbc:freshness` is quiet across the repo, and fails with
  `started_at is 28733.6h AFTER now` on a staged dir declaring 2030. Both runs are pasted in
  check.md.
