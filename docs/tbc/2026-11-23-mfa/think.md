---
started_at: 2026-11-22T23:00:00Z
trigger: Founder picker 2026-11-23 "Multi-factor sign-in (Recommended)" — first build from the still-to-build list (gong.io capture F36 "Multi-factor authentication"); founder then "keep building everything in the list".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Multi-factor sign-in (authenticator app)

## The record

- Gong offers optional MFA with authenticator-app codes (gong.io trust pages, capture of 2026-11-22; ledger F36,
  graded LACK on 2026-11-23). Our privacy page already says "future second-factor path" (src/app/privacy/page.tsx:388).
- Sign-in today: email + password through POST /api/auth/sign-in (attempt log + D4 lockout) and Supabase's session
  cookie. Pages are guarded by src/middleware.ts (getUser → decideAuthRedirect → module lock); its matcher covers
  /dashboard, /onboarding and the two login pages only.
- API routes: 395 route files; most call `supabase.auth.getUser()` themselves, others use resolveApiAuth /
  getCurrentAuthContext / require* helpers, many then switch to the service-role client (RLS bypassed). Mobile and
  extension callers send a Bearer access token (resolveApiAuth's second path).
- Supabase: supabase-js 2.105.4 / @supabase/ssr 0.10.3. The project signs access tokens with an asymmetric ES256 key
  (`/auth/v1/.well-known/jwks.json` → [EC, ES256, sig]), so `auth.getClaims()` verifies a token locally, with no
  network call. Access-token claims carry `aal` (aal1 | aal2) and `app_metadata`.

## Outside view

A second factor that the server does not enforce is decoration: someone with the password signs in, never opens the
code screen, and calls the API directly. The failures to fear: a page guard with an API left open (395 routes, no single
helper); a "has MFA" signal the user can edit in their own cookie (the cookie's user object is not signed); a check that
costs a network call on every API request; locking a user out of the mobile app or extension that cannot ask for a code;
an unenroll that a stolen aal1 session can perform; and a code endpoint with no rate limit.

## Design

1. The trusted signal is the SIGNED token: `app_metadata.mfa === true` (written only by the service role when a factor
   is confirmed, cleared when the last one is removed) and `aal`. Never the cookie's unsigned user object.
2. One enforcement point in front of everything: the middleware matcher adds `/api/:path*`. With no session cookie it
   returns at once (cron, Bearer). With one, `getClaims()` verifies locally; `mfa && aal !== "aal2"` → pages redirect to
   /login/verify, API answers 401. Allowlisted: the code routes themselves, sign-in/out, /login*.
3. Bearer callers (mobile, extension): resolveApiAuth applies the same rule to the token's claims. They cannot ask for a
   code yet, so the enrol screen says turning this on signs them out of those until they support it.
4. Enrol, confirm, list and remove run server-side on the caller's session (POST/GET/DELETE /api/me/mfa); removing a
   factor needs an aal2 session. The code routes are rate-limited.
5. Not in this build (filed): a company-wide "require MFA" policy; codes in the mobile app and extension; recovery codes
   (an admin can remove a member's factor instead).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Understand before building: how sign-in, the page guard and 395 API routes establish identity was read before any design.",
    "how_this_build_will_embody_it": "The record section above is what was read; the design follows from the 395-route finding."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session (timestamps below)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Layer 2: a second factor that can be skipped does not work, whatever the screens look like.",
    "how_this_build_will_embody_it": "Enforcement in front of every page, every /api route and every table; the PGlite replay shows an aal1 MFA token reads 0 rows."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Look past the task: the browser's direct REST path was not in the first design.",
    "how_this_build_will_embody_it": "Found while building the middleware guard; closed with 0309 and a live invariant; definer functions filed (F1)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "TOTP must be enabled in the Supabase project (dashboard config outside the repo).",
    "how_this_build_will_embody_it": "Enrolment fails loudly; closure records the setting as a blocking precondition (R1)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Single-source decisions: every guard consumes one verdict.",
    "how_this_build_will_embody_it": "mfaVerdict in lib/auth/mfa.ts is used by the middleware, resolveApiAuth and extensionAuth; the database rule mirrors it in rss_mfa_ok()."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Events are append-only: every change to who must enter a code is a fact that must stay on the record.",
    "how_this_build_will_embody_it": "Turning codes on/off and resets are appended to audit_log; no history is edited."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched by this build (cited in recent commits; read to confirm no interaction)."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Guide, don't overtake: which feature to build next, and how a person turns codes on, stay the founder's and the person's choice.",
    "how_this_build_will_embody_it": "The founder chose this build from a picker; the panel states the mobile/extension limit before anyone turns codes on."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Honesty: no claimed capability that isn't there.",
    "how_this_build_will_embody_it": "The Settings panel says the mobile app and extension can't ask for codes yet."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The next build was chosen by a picker; design choices the record settles were not put to the founder."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The live invariant fails when a table that grants access lacks mfa_required."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T00:01:13Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
