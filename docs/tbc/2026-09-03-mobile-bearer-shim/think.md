---
started_at: 2026-09-03T01:20:00+08:00
---

# THINK — accept a mobile Bearer token on the coach routes

## Why
The native Sales Coach app reuses this backend rather than forking it. Reads go direct to Supabase under RLS and
need nothing here. Anything that runs server logic — KPI compute, transcription, session writes — is reached
through these routes, and today they resolve the caller from the **web SSR cookie**. A mobile client has no
cookie, so every one of those routes is closed to it.

The app-side work is complete and waiting: the KPI board, the trend, the team roster, recording upload, outcome
and rename all call these routes and currently render an honest "not switched on yet" on the 401.

## Understanding — the plan document is wrong about this, and following it literally would ship broken routes

`06-BACKEND-BEARER-SHIM.md` says each route is a one-line change: swap `getCurrentAuthContext()` for a resolver
that also accepts a Bearer token. That is true for the **KPI** routes, which consume an `AuthContext` and nothing
else.

It is **not** true for the session routes. `/[id]/outcome`, `/[id]/upload-recording`,
`/[id]/upload-recording/sign` and `/[id]/label-transcript` take a **cookie-bound Supabase client** and then use
that client for RLS-scoped reads — `getSession(id)` is their access check. Swapping only the auth check leaves a
Bearer caller authenticated and then invisible to itself: the client has no session, RLS returns nothing, the
session reads as missing, and the route 404s a session that exists.

Two further facts found by reading rather than assuming:

- **Nothing in this repo had previously combined Bearer auth with RLS-scoped database access.** Every
  `extension/**` route that accepts a Bearer token touches zero tables — they are pure AI endpoints. So there was
  no existing pattern to copy.
- `getSessionTranscript(id)` inside `/label-transcript` is the guard that stops an existing transcript being
  clobbered. Cookie-bound, it reads empty for a mobile caller, which would take the **append** path instead of the
  atomic replace — one call, doubled transcript.

## Four-layer trace

- **L1 structure:** two small helpers. `resolveApiAuth` widens identity (cookie first, then a Bearer token
  validated exactly as `requireExtensionAuth` validates one). `callerScopedDb` builds a Supabase client from the
  anon key plus the caller's own JWT. `getSession` and `getSessionTranscript` gain an **optional** client
  argument, so every existing caller is unchanged.
- **L2 effectivity:** on the Bearer path `auth.getUser()`, the profile read and the RLS-scoped `getSession` all
  behave exactly as they do for a cookie caller, because the client carries the caller's JWT. `auth.uid()`
  resolves to them and every existing RLS policy applies unchanged.
- **L3 continuity:** the web path is untouched — `callerScopedDb` returns null without a Bearer header and the
  route falls back to `createClient()` exactly as before. Every existing test passes unmodified except the two
  whose `GET()` signature gained a request parameter.
- **L4 surface:** no UI change in this repo. The app renders the 401 honestly today and will simply start
  receiving data.

## The security decision, stated plainly

The scoped client uses the **anon key**, never the service role. PostgREST reads the caller's JWT and every RLS
policy applies as written — the same rules the website runs under, not a second set. The service-role client
would bypass RLS entirely and turn each of these routes into a place where one missing ownership check becomes a
cross-tenant read. This shape fails **closed**: a bad or expired token returns nothing, never someone else's rows.

## What I expect to be wrong about

That `/outcome` needs the full context. It never required a company, so using the full resolver there would start
rejecting a signed-in user who has none — a behavioural change to the **web** path introduced while adding mobile
support. (This is what happened; see build.md.)

## Session-read manifest (A22 — each asset opened in THIS session, not cited from cache)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T02:40:00+08:00",
    "why_it_governs": "Understanding precedes solving. The plan document said this was a one-line swap on every route; acting on that without earning the understanding would have shipped routes that authenticate a mobile caller and then 404 their own session.",
    "how_this_build_will_embody_it": "Read getSession and getSessionTranscript before editing any route, and found that their access check is an RLS-scoped read rather than an auth call. That is why callerScopedDb exists." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T02:40:30+08:00",
    "why_it_governs": "The methodology must be in the working tree at the moment of action, and citing labels from a document not consulted is forbidden.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are both in this tree and were opened this session. Separately, this session removed eight citations of a numbered section that does not exist in any file here — I had only ever seen a reference to it. Each was replaced with the rule stated in plain language." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-108", "read_at": "2026-09-03T02:41:00+08:00",
    "why_it_governs": "Four layers, foundation up. This change is layer 2 — the routes exist and are well-structured; they simply do not work when invoked the way the mobile app invokes them.",
    "how_this_build_will_embody_it": "The four-layer trace above is written out. Layer 3 is the load-bearing one: the web cookie path must be left exactly as it was, which is why callerScopedDb returns null without a Bearer header and every route falls back to createClient()." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-162", "read_at": "2026-09-03T02:41:30+08:00",
    "why_it_governs": "THINK first, then search — hypotheses guide the search, and a bug rarely lives alone.",
    "how_this_build_will_embody_it": "The hypothesis was 'a Bearer caller will authenticate and then read nothing'. Searching for it found the /label-transcript case, which is worse than a 404: an empty transcript read takes the append path instead of the atomic replace, so one call would double the transcript." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-472", "read_at": "2026-09-03T02:42:00+08:00",
    "why_it_governs": "The checklist before any substantive action.",
    "how_this_build_will_embody_it": "Item 1a is the one that bit: I had been citing a section this session without having read it. Item 5c also applies — this shim is inert until deployed, and the deploy is named as a blocking external step in check.md rather than assumed." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-03T02:43:00+08:00",
    "why_it_governs": "Labels propagate through commits and comments far faster than content propagates from an unread source, so the agent ends up operating in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "Read this session. It describes the invented-citation failure above exactly: I had the label from a reference in a plan document and never the content." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-03T02:43:30+08:00",
    "why_it_governs": "Citing constitutional sections from cached memory is an A19 violation operating undetected.",
    "how_this_build_will_embody_it": "This manifest was written after opening each cited clause, and each why/how below is written from what the clause actually says rather than from what its label suggests." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-03T02:44:00+08:00",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is encoded in a gate that fails without the author's cooperation. A30's own example is an RLS lens hole that an audit reported green through.",
    "how_this_build_will_embody_it": "Two gates, not two paragraphs. The invariant audit gained three self-tests including one asserting it still rejects an ungated mutation. And the scoped client is built from the anon key, never the service role — A30 names the service-role client in a data route as the shape that produced the vendor hole." },

  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "46-77", "read_at": "2026-09-03T08:05:00+08:00",
    "why_it_governs": "Living Diagnosis: identify a problem by looking BACKWARD at the actual record, and do not implement until the root cause is explained rather than the symptom. Step 5 adds the holistic clause — never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "It decided today's blocker. This commit was refused repeatedly and I twice concluded the ceremony of an unrelated build was incomplete. Reading the actual record instead — core.autocrlf=true, `git show HEAD:` returning LF, the working tree holding CRLF, and frontMatter() matching /^---\n/ — gave the real cause: the TBC parser cannot read a Windows checkout, so it was failing for every build on this machine, not for non-compliance. The symptom said 'your manifest is incomplete'; the record said 'the file cannot be parsed'." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-228", "read_at": "2026-09-03T08:06:00+08:00",
    "why_it_governs": "A user-specified experience binds at layer 2 and is never waivable as layer-4 polish. The owner of the mobile app specified that it and the web must carry the same features — so parity IS the intended result, not decoration on top of one.",
    "how_this_build_will_embody_it": "These routes exist only so the phone can show real figures. Without them the mobile screens render honest empty states, which passes every automated check and delivers nothing the owner asked for — precisely the confident-well-formed-failure this clause names. Three more routes were added after sweeping the phone's source for every /api/coach path it calls, rather than shipping the subset I had reasoned my way to." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-333", "read_at": "2026-09-03T08:07:00+08:00",
    "why_it_governs": "An authority must return a verdict and consumers must branch on it, never re-derive the same decision from raw inputs — duplicated conditions drift, and the copy that loses a term defeats the gate with every check green.",
    "how_this_build_will_embody_it": "This is the exact shape of the substitution. `callerScopedDb(req)` is the single authority on 'is this a Bearer caller, and what client should serve them'; every one of the eighteen routes consumes its verdict as `callerScopedDb(req) ?? (await createClient())`. Not one of them re-reads the authorization header or re-decides mobile-ness for itself, so there is no second copy of the condition to drift." },

  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-03T08:08:00+08:00",
    "why_it_governs": "Honesty is the moat: a system that claims understanding it cannot have is lying, and the refusal to fake day-one behaviour is structural rather than stylistic.",
    "how_this_build_will_embody_it": "Carried into the client these routes serve. Until this branch merges the phone cannot read these figures, and every screen that depends on them says so rather than rendering a zero — a failed load and a real zero are indistinguishable to a rep, and four separate guards in the app now exist because that lie was written four times." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-03T08:09:00+08:00",
    "why_it_governs": "Distrust the confident answer that arrived too quickly; a fluent well-sourced answer imitates understanding convincingly. And the biggest risk is the builder under pressure making the method less honest for a faster result.",
    "how_this_build_will_embody_it": "Recorded rather than tidied away: check.md's F2 is my own substitution of a three-command subset for the canonical gate, reported as verified. Today the same shape recurred twice — I read an exit code from `tail` rather than the verifier and briefly believed three gates passed, and an accessibility sweep reported 56 violations that were an artefact of matching the `>` inside `onPress={() =>`. Both were fast, fluent and wrong; both were caught by re-running the real thing." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-03T02:45:00+08:00",
    "why_it_governs": "\"Verified\" is a claim about a command you ran. Given a canonical gate and a faster subset, the subset wins, and the report reads identically.",
    "how_this_build_will_embody_it": "It caught me mid-build. I had run tsc, vitest and the invariant audit — three of seven — and written check.md saying so. Reading A38 sent me to `npm run check`, which FAILED on an unused import I had left in sales-session/route.ts. The subset was green the whole time. check.md now records the canonical gate." }
]
```
