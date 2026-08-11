---
tbc_version: 1
trigger: fix
started_at: 2026-08-11T19:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — Sweep the CWE-209 class at the src/lib (helper/data-layer) altitude; fix the one client leak

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged.

## 2. Why (A26 — sweep to the boundary; xj-R1 named this altitude)
xi/xj swept the raw-error CWE-209 class at the ROUTE altitude. But the two field-shape leaks originated in LIB
helpers that returned `{ ok:false, error: <raw> }`; the route only forwarded. So the true source altitude is
`src/lib`. Swept it: `error:\s*[ident]?.message`, the nested form, the two-step `error: msg`, and the
interpolated `${...message}` — then classified each hit by reading its consumer (a helper's raw string is a
leak only if a consumer returns/renders it to a client).

## 3. Classification (each hit read + its consumer traced)
- CONTROLLED / contained (leave):
  - `assets.ts:228,333` (`uploadAssetBytes`, `createSignedUploadTarget`) return a raw `msg` — but every caller
    now genericizes it (F2/F6 + xh), and the bucket-not-found branch is a deliberate OPERATOR-actionable
    message. Contained at the callers; the route-level invariant 14 (+ xj) guards new callers.
  - `outbound.ts:209,223` (`dispatchOutboundEmailReply`) interpolate a raw `${e.message}` — but BOTH callers
    (`care/agent/.../messages`, `care/inbound/email`) `console.error` `r.error` and never return it to a
    client (async dispatch after the message already posted). Logged, not surfaced.
  - `extensionAuth.ts:30` `unauth(message)` — `message` is a caller-supplied CURATED string.
  - `useSseStream.ts:77` — CLIENT-side error state, not an API response.
- **LEAK — `chats.ts:542` (`fetchTopics`)**: returns `{ mode:"live-error", error: `${code}: ${error.message}` }`,
  RENDERED at `chats/page.tsx:103` as "Could not load topics — 42P01: relation … does not exist". A raw
  Postgres code+message in an authed member's chat UI. The `console.error` above already logs the raw cause,
  and the `live-error` MODE (not the string) is what INV22 needs to distinguish error from empty — so the raw
  string is pure leak.

## 4. The fix
`chats.ts:542` returns a GENERIC "please try again in a moment"; the raw cause stays in `console.error`; the
`live-error` mode is unchanged (INV22 preserved). NOTE: the existing test
`chats.fetchTopics.test.ts:75` had LOCKED the leak (`expect(out.error).toBe("42P01: view is stale")`) — a test
encoding the wrong behavior. Updated to assert the generic string + `not.toContain` the raw code/message,
keeping the `mode === "live-error"` INV22 assertion.

## 5. Record check (§1.2) — intentional?
The comment said "return a distinct live-error the UI surfaces" — the INTENT is the error-vs-empty signal
(INV22), satisfied by the mode. Surfacing the raw MESSAGE was not required by that intent; it's the same
authed-member-facing raw-DB-error class the prior sweeps fixed. Not a deliberate raw surface.

## 6. Hypothesis (§1.5.2)
- **H1 — is chats the only client-facing leak at this altitude?** → Yes for the reachable set: every other
  src/lib raw-`.message` in an error field is either contained at a genericizing caller, logged-not-returned,
  or a curated/caller-supplied string (section 3). CONFIRMED by tracing each consumer.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T19:00:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — classify each hit by reading its consumer, not by pattern.", "how_this_build_will_embody_it": "Traced every src/lib raw-.message error field to its consumer before deciding leak-vs-contained." },
  { "id": "§0.1", "read_at": "2026-08-11T19:00:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-11T19:01:00Z", "source_file": "CLAUDE.md", "line_range": "178-182", "why_it_governs": "Retrospective — check whether the surfaced raw message is a deliberate intent before fixing.", "how_this_build_will_embody_it": "Section 5 confirms the INV22 intent is the mode, not the raw string." },
  { "id": "§1.5.1", "read_at": "2026-08-11T19:01:15Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the fix must keep the INV22 error-vs-empty property intact.", "how_this_build_will_embody_it": "Kept mode:live-error; only the client string changed; the test's INV22 assertion is preserved." },
  { "id": "§1.5.2", "read_at": "2026-08-11T19:01:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive — sweep the class at the altitude that actually sources it.", "how_this_build_will_embody_it": "Swept src/lib (helper/data-layer), the source of the field-shape leaks." },
  { "id": "§3.4", "read_at": "2026-08-11T19:01:45Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a raw DB string in the UI is a leak; a generic live-error is the honest surface.", "how_this_build_will_embody_it": "The chat UI now shows a generic retry, not the Postgres relation name." },
  { "id": "§6", "read_at": "2026-08-11T19:02:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The decision checklist forces consumer-tracing + record-check before acting.", "how_this_build_will_embody_it": "Every hit's consumer traced; only the one client-rendered leak changed." },
  { "id": "A16", "read_at": "2026-08-11T19:02:15Z", "source_file": "ThinkerThinker.md", "line_range": "40-52", "why_it_governs": "Apply-here-miss-there — the generic-error posture must reach the data layer, not only routes.", "how_this_build_will_embody_it": "Extends the CWE-209 posture to a data-layer read that renders raw to the UI." },
  { "id": "A19", "read_at": "2026-08-11T19:00:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read chats.ts + its UI consumer + the existing test in-tree before changing them." },
  { "id": "A22", "read_at": "2026-08-11T19:02:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-11T19:02:45Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "A found bug is a class — sweep it to the codebase boundary (every altitude).", "how_this_build_will_embody_it": "Completed the CWE-209 sweep at the src/lib altitude after the route altitude (xi)." },
  { "id": "A30", "read_at": "2026-08-11T19:02:50Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "A fix is complete only when the class is in a gate that fails without the author.", "how_this_build_will_embody_it": "The updated chats.fetchTopics test asserts the generic string + not.toContain the raw code/message, so a revert to the leak fails the test." },
  { "id": "A38", "read_at": "2026-08-11T19:03:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check runs with exit codes." }
]
```
