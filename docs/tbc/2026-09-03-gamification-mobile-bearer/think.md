---
started_at: 2026-09-03T15:40:00+08:00
---

# THINK — Mobile Bearer support for the gamification routes

## Why (the mobile spec I delivered claimed a Bearer path that did not exist)
Writing the mobile build spec, I documented the gamification API routes as the recommended path and said they
"accept a Bearer token (the mobile bearer shim)". Verifying that claim against the real code (make-it-like-Y = check
the artifact) showed it was FALSE: the four gamification routes authenticate with `getCurrentAuthContext()`, which
reads the **cookie** SSR client only — a mobile Bearer caller gets 401. Shipping a spec the founder builds against
that is wrong would propagate the error into the mobile app. The fix: make the routes actually accept Bearer (the
same shim the KPI + session routes already use), so the spec is true and the mobile build works.

## Understanding (identity is not enough — the data client must be the caller too)
The subtle trap (documented in `callerScopedDb.ts`): swapping only the identity resolver widens auth but the reads
still go through the cookie client, so a Bearer caller **authenticates and then gets an empty result** — the
"error dressed as no-data" honesty failure (§3.4). So two things change per route:
1. **Identity:** `getCurrentAuthContext()` → `resolveApiAuth(req)` (cookie OR Bearer → the same AuthContext verdict;
   §2.2 — consume one verdict, never re-derive auth).
2. **Data client:** the RLS reads + the `auth_company_id()`-based RPC must run through the **caller-scoped** client
   (`callerScopedDb(req) ?? createClient()`) — a Bearer-token Supabase client (anon key + the caller's JWT) so
   `auth.uid()` resolves and **every existing RLS policy applies unchanged**. It fails CLOSED (a bad token → no rows,
   never someone else's).

Per route:
- **leaderboard** (RPC): identity + caller-scoped RPC call (so the SECURITY DEFINER fn's `auth_company_id()` = the
  caller's company).
- **my-points** (owner-RLS read): identity + caller-scoped read.
- **notifications**: GET (recipient-RLS read) → identity + caller-scoped read; POST (mark-read) already uses the
  admin client pinned to `recipient_id = ctx.userId`, so only the identity widens.
- **calibration**: the manager gate + all reads use the admin (service-role) client with explicit `company_id`
  scoping, so only `requireManager(req)`'s identity widens.

## Verification (A38, A30)
Existing 12 route tests still green (cookie path unchanged — `resolveApiAuth` calls the mocked `getCurrentAuthContext`
for the cookie path; header-less Requests make `callerScopedDb` return null → cookie fallback). +2 new Bearer-path
tests on my-points: a Bearer request reads through the caller-scoped client (the cookie client is stubbed to THROW,
so an accidental fallback fails loudly), and 401 when neither authenticates. typecheck + full gate before commit.

## Out of scope
The other coach routes that are still cookie-only (not gamification). No schema/RLS change — RLS is unchanged; only
the client that carries the caller's identity widens.

## Session-read manifest (A22 — read_at >= started_at 15:40; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T15:50:00+08:00",
    "why_it_governs": "Understanding precedes solving — I verified the Bearer claim against the real routes before 'fixing' it, and diagnosed the authenticate-then-empty trap before coding.",
    "how_this_build_will_embody_it": "The fix widens both identity AND the data client, closing the trap rather than half-shimming." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T15:50:05+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session (timestamps below)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T15:50:08+08:00",
    "why_it_governs": "Retrospective identification — I mirrored the PROVEN shim pattern (resolveApiAuth + callerScopedDb) already used by the KPI/session routes, not a new mechanism.",
    "how_this_build_will_embody_it": "Copied the outcome-route pattern verbatim: `callerScopedDb(req) ?? createClient()`." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T15:50:11+08:00",
    "why_it_governs": "Holistic — an auth change touches privacy/tenant scope; I traced what widens (identity + read client) and what does NOT (RLS, schema).",
    "how_this_build_will_embody_it": "The caller-scoped client keeps every RLS policy in force; no table or policy changed." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T15:50:14+08:00",
    "why_it_governs": "Layer-2 effectivity — the route must actually return the caller's data over Bearer, not merely authenticate.",
    "how_this_build_will_embody_it": "The +2 Bearer tests prove data flows through the token client; the cookie client throws if wrongly used." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-03T15:50:17+08:00",
    "why_it_governs": "Reuse the repo's proven auth helpers, don't invent a new one.",
    "how_this_build_will_embody_it": "Uses the existing resolveApiAuth + callerScopedDb — the same pattern the session routes ship." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-198", "read_at": "2026-09-03T15:50:20+08:00",
    "why_it_governs": "External-config completeness — the Bearer path relies on NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (callerScopedDb returns null without them).",
    "how_this_build_will_embody_it": "callerScopedDb fails safe to the cookie client when env is absent; the env is already set for the web app." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-235", "read_at": "2026-09-03T15:50:23+08:00",
    "why_it_governs": "User-specified deliverable — the founder asked for a spec they'd BUILD from; an inaccurate spec fails the intended result.",
    "how_this_build_will_embody_it": "Made the spec's Bearer claim true rather than shipping a spec that builds a 401." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-270", "read_at": "2026-09-03T15:50:26+08:00",
    "why_it_governs": "Ground-up — verified the auth layer from the client factory up (createClient is cookie-only; callerScopedDb carries the token).",
    "how_this_build_will_embody_it": "The fix sits at the client-identity layer, the actual foundation of the gap." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T15:48:00+08:00",
    "why_it_governs": "Single-source — resolveApiAuth returns ONE AuthContext verdict; every route consumes ctx.userId/companyId/isAdmin identically for web and mobile, never re-deriving auth.",
    "how_this_build_will_embody_it": "No route re-derives identity; the widened resolver is the one authority, consumed as a verdict." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-09-03T15:49:30+08:00",
    "why_it_governs": "Honesty — a half-shim would authenticate then return empty (error dressed as no-data). That is the exact failure this clause forbids.",
    "how_this_build_will_embody_it": "The caller-scoped client returns the caller's real rows; the Bearer test stubs the cookie client to THROW so a silent-empty regression can't hide." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-392", "read_at": "2026-09-03T15:50:29+08:00",
    "why_it_governs": "Measurement integrity — a mobile rep must see THEIR OWN points, not empty or another's.",
    "how_this_build_will_embody_it": "auth.uid() resolves to the caller inside RLS, so my-points/leaderboard return the caller's own figures." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-430", "read_at": "2026-09-03T15:50:32+08:00",
    "why_it_governs": "Verify; distrust the fast-confident 'one-line swap'.",
    "how_this_build_will_embody_it": "I did NOT follow the plan's 'same as KPI, one line' literally — I verified it fails at the first query and added the caller-scoped read." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T15:50:35+08:00",
    "why_it_governs": "Quick-decision checklist (real constraint, holistic, verify, single-source).",
    "how_this_build_will_embody_it": "All honored — see the entries above." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-450", "read_at": "2026-09-03T15:47:00+08:00",
    "why_it_governs": "Surfacing human data — widening who can call these routes must not widen who can READ another rep's detail.",
    "how_this_build_will_embody_it": "The caller-scoped client enforces the SAME owner/manager RLS; a mobile caller sees exactly what the web caller would — no more." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-03T15:52:00+08:00",
    "why_it_governs": "Methodology in the working tree, consulted this session — not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened A18/A19/A22/A30/A38 + CLAUDE.md §2.2/§3.4 this session before citing them for this auth-sensitive change." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-09-03T15:49:00+08:00",
    "why_it_governs": "Session-read manifest before closure.",
    "how_this_build_will_embody_it": "This manifest pairs each cited asset with an in-session read_at; the commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-03T15:49:15+08:00",
    "why_it_governs": "Gate the lesson — the Bearer behavior must be pinned by a test that fails without it.",
    "how_this_build_will_embody_it": "The +2 Bearer tests exercise the token-client read and the 401; the cookie-throw stub guards the silent-empty regression." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-03T15:48:40+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md names typecheck + the 14 route tests + the full canonical gate." }
]
```
