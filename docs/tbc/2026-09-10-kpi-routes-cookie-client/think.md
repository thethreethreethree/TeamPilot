---
started_at: 2026-09-10T13:00:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - four KPI routes authenticate the app and then read as nobody

## Why (the record)
The founder asked for a sweep: "search for all possible bugs in the system." Rather than reason about
likely places, I enumerated: every screen (34), every endpoint the app calls (23), and then checked each
endpoint against the class this codebase has already paid for four times - a Bearer-reachable route that
resolves its data through a COOKIE client.

The first grep looked for `callerScopedDb` and produced eight suspects. That grep was too narrow: a second
Bearer mechanism exists (`resolveApiAuth`), and opening the suspects rather than counting them is what
separated the real from the imagined. Five survived. Then the app's own code contradicted me - a comment in
`kpi.tsx` records that on 4 September `/api/coach/kpi/me?scope=day` "answered 200 with real metrics" - so I
stopped reading and measured.

## What was measured, on production, on 10 September 2026
A real mobile Bearer token was minted for the founder's own account and used against elostate.com.
`/api/coach/sales-session/macro-mode` answered `{"enabled":false}` on that token, so the token is good and
any empty answer below is the route rather than the caller.

    /api/coach/kpi/me?scope=self     200  {"sessionCount":0, every metric value:null, gated:true}
    /api/coach/kpi/me?scope=day      200  same
    /api/coach/kpi/trajectory        200  {"building":true,"monthsCovered":0,"metrics":[]}
    /api/coach/kpi/team              403  {"error":"Manager access required."}
    /api/coach/sales-session/quota   401  {"error":"Not authenticated."}

The same account, read with the service role, holds **73 coaching_sessions**, **24 kpi_snapshot rows**, and a
profile with `role: admin` AND `sales_coach_role: admin`.

So: three whole screens in the native app - KPI, Trend, Team - show every rep a confident nothing, and a
company admin is told they are not a manager.

## Understanding
`resolveApiAuth` widens IDENTITY. It returns an `AuthContext` and never a database client. Each of these
routes then does `const sb = await createClient()`, which resolves its session from cookies; a Bearer caller
sends none, so every query runs anonymous. An anonymous read of `coaching_sessions` returns `200 []` - not an
error, an empty array - which is why this ships silently and why the app renders "building" rather than a
failure.

`quota` is worse in a small way: `export async function GET()` takes no request at all, so it could not read
an Authorization header even in principle.

## Why the guard written for this class did not catch it
INVARIANT 26 was added on 5 September, after four bugs of exactly this shape. It walks the import graph from
each Bearer route and flags library modules that resolve a cookie client. Its condition reads:

    if (f && n !== start && n.startsWith("src/lib/") && COOKIE_CLIENT_RE.test(f.sql) ...

`n !== start` skips the route's own body. `n.startsWith("src/lib/")` restricts the search to libraries. The
four bugs the rule was BUILT from all happened to live in libraries, so "library" was written into the rule as
though it were the class. It was a property of the sample. Every route that resolves its own cookie client was
invisible to it, and the audit reported 0 violations the whole time.

`callerScopedDb.ts`'s own header states the assumption in words: "resolveApiAuth widens IDENTITY, which is all
the KPI routes needed - they consume getCurrentAuthContext() and nothing else." They do not. That sentence is
why these routes were left out of the fix that repaired the session routes.

## Ripple (1.5)
- Four routes change one line each; the web cookie path is unchanged because `callerScopedDb` returns null
  without a Bearer header and the expression falls through to exactly what was there before.
- `quota`'s GET gains a request parameter. Its tests called `GET()` with no argument and now pass a request
  with no Authorization header, which keeps every existing expectation on the cookie path.
- Widening INVARIANT 26 flags the route body as well. Two further routes surfaced that the app does not
  currently call - `sales-session` GET and `[id]/segments` POST - and both are closed rather than allowlisted,
  because an allowlist entry rots and a one-line fix does not.
- The rule counts rather than matches: the CORRECT pattern contains the string `await createClient()` as its
  fallback, in two spellings, so a presence-test flagged all 27 Bearer routes including every correctly fixed
  one.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-10T13:02:00+08:00",
    "why_it_governs": "Understanding precedes solving - a code comment claimed these routes worked, so the claim had to be measured rather than argued with.",
    "how_this_build_will_embody_it": "A real token was minted and the routes probed against production before a line was changed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-10T13:02:00+08:00",
    "why_it_governs": "The methodology must be in the tree and read now.",
    "how_this_build_will_embody_it": "Every clause below was opened in this session; the document hashes are pinned above." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-76", "read_at": "2026-09-10T13:03:00+08:00",
    "why_it_governs": "Holistic - never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "The web cookie path is preserved by construction, and the quota test change is named in the ripple." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-10T13:03:00+08:00",
    "why_it_governs": "Proactive audit - think first, then search, and audit the adjacent surface.",
    "how_this_build_will_embody_it": "The founder asked for a sweep; the endpoint inventory was enumerated mechanically rather than recalled, and the guard's own blind spot was checked as an adjacent surface." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-10T13:04:00+08:00",
    "why_it_governs": "Honesty is the moat - a failed read must never render as an empty one.",
    "how_this_build_will_embody_it": "This is that failure exactly: 73 sessions rendered as 'building'. The fix restores the read; the report names what was measured rather than what was assumed." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-10T13:31:00+08:00",
    "why_it_governs": "Layer 2 - does the feature deliver the intended result when a real caller invokes it, not does a unit test pass.",
    "how_this_build_will_embody_it": "Layer 2 is exactly what failed here: every test passed and the route returned 200 while the app saw nothing. It was settled by invoking the route the way the app does, with a real token." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-454", "read_at": "2026-09-10T13:31:00+08:00",
    "why_it_governs": "Item 0 - a choice among courses goes to the founder as a picker with a recommendation.",
    "how_this_build_will_embody_it": "Whether to fix these now or keep sweeping went to the founder as a picker; F3 is surfaced with a recommendation rather than deferred silently." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-10T13:31:00+08:00",
    "why_it_governs": "Citing a label without its content is operating in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "Every id in this manifest was opened in this session, including A21 and A26 which were read immediately before being cited here." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-607", "read_at": "2026-09-10T13:31:00+08:00",
    "why_it_governs": "The manifest closes the gap between citing at the speed of language and reading at the speed of attention.",
    "how_this_build_will_embody_it": "Each entry carries an in-session read_at that postdates this build's started_at." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-543", "read_at": "2026-09-10T13:05:00+08:00",
    "why_it_governs": "An audit that looks within one boundary misses what sits across it.",
    "how_this_build_will_embody_it": "INVARIANT 26 looked within libraries and never at routes. The boundary, not the content, was the defect, and the rule now covers both." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-702", "read_at": "2026-09-10T13:05:00+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept to its boundary, and a pattern match is a SUSPECT rather than a defect.",
    "how_this_build_will_embody_it": "All 23 app endpoints were swept, every suspect was opened rather than counted, the first grep's eight were reduced to five by reading, and the widened rule's 27 were reduced to 2 by reading." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-789", "read_at": "2026-09-10T13:06:00+08:00",
    "why_it_governs": "A fix is not complete until the class is encoded in a gate that fails without the author's cooperation - and a gate that cries wolf is one people learn to skip.",
    "how_this_build_will_embody_it": "The gate is widened AND made precise (27 false positives down to 2 real ones), and it was proven to bite by reverting one fix." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1022", "read_at": "2026-09-10T13:06:00+08:00",
    "why_it_governs": "Verified is a claim about a command you ran, by its name.",
    "how_this_build_will_embody_it": "check.md pastes npm run check with its exit code, plus the production probe before and after." }
]
```
