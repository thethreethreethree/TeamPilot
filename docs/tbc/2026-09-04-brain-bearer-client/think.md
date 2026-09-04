---
started_at: 2026-09-04T14:30:00+08:00
---

# THINK - every AI feature in the mobile app failed while the browser was fine

## Why (the record)
The founder reported, from a TestFlight build on a phone with full bars and fast Wi-Fi, that every
AI feature in the mobile app was failing - and stated plainly that the same account worked in the
web app. "Ask the coach" returned "Could not reach the coach. Try again when you have signal."

## Understanding (SS0 - earned, not assumed)
Six hypotheses were raised and each was DISPROVEN with evidence before any code was changed, which
matters because SS2 forbids retrying a misdiagnosis with force:

1. Serverless timeout - every LLM route already sets `maxDuration`. Swept, all present.
2. Wrong API base - `https://elostate.com/api/coach/...` answers 401/405, so the routes are live.
3. Streaming unsupported on React Native - the app uses `expo/fetch`, which streams correctly.
4. A route with no Bearer shim - every route the app calls resolves a Bearer token. Swept, all 25.
5. `SUPABASE_SERVICE_ROLE_KEY` missing in production - DISPROVEN by probe: a bogus Bearer against a
   `resolveApiAuth` route returns 401, not the 500 a missing key would throw.
6. A profile gate (`status = 'removed'`) - DISPROVEN by reading the rows: all `active` with a
   `company_id`.

The identification was only earned by REPRODUCING the failure rather than reasoning about it. A
short-lived access token was minted for a real account and the app's exact call replayed:

```
POST /api/coach/extension/dissect   -> 200  {"dissect":{"hasSignal":true,...}}
POST /api/coach/extension/suggest   -> 502  {"error":"Couldn't draft a suggested response right now."}
```

Same token, same account, same entitlement, one minute apart. That exonerates auth, the entitlement,
the network, the model and the app. The 502 body carries NO `kind`, which is the `llmErrorResponse`
branch for a **non-LLM failure** - a thrown exception, not a model error.

`suggest` calls `runBrainStream`; `dissect` does not touch brain. Reading `src/lib/brain/index.ts`,
`loadBrain()` and `loadControlGate()` both resolve their client with `await createClient()`, which
reads a session **from cookies**. A browser has cookies. The mobile app and the browser extension
authenticate with a Bearer token and send none, so that client is anonymous, RLS returns nothing,
`maybeSingle()` yields null, and both functions throw.

Confirmed directly against the live database:

```
anon key    : company_brain -> []            companies -> []
service key : company_brain -> [{version:4}] companies -> [{ai_guidance_enabled:true}]
```

The data was healthy the entire time. The code simply could not see it.

## Second, separate defect
`sales-session/roleplay` returned a bare **500 with an EMPTY body** on a request whose shape matches
its own Zod schema exactly. Everything after `readBody` ran outside a try, so any throw was left to
the framework. An empty body is the worst possible answer to a client: the app synthesises
`HTTP 500`, its error reader correctly rejects that as a status code wearing a sentence's clothes,
and the screen falls back to its own guess about the cause. That is how a rep on full signal was
told to go and find signal.

## SS1.5.1 layers
- Layer 1 (structure): a shared library assumed one transport's auth. Two client kinds, one code path.
- Layer 2 (effectivity): the feature returned 200 in a browser and 502 everywhere else.
- Layer 3 (composition): the failure surfaced as a *connection* error, sending everyone - the founder
  and the agent - to diagnose the network for hours.

## Session-Reads (A22 / SS3.1.2)

```json
[
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-04T15:42:45+08:00",
    "why_it_governs": "The methodology defining understanding must be in the working tree and read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md were both re-opened in this session at the times recorded here before any clause was cited." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-04T15:42:45+08:00",
    "why_it_governs": "THINK first, then search, and audit the surfaces adjacent to the one being touched.",
    "how_this_build_will_embody_it": "The adjacent sweep found twelve further files carrying the same cookie-client assumption. They are recorded as residual BRAIN-R1 rather than changed on suspicion during a live outage." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-04T15:42:45+08:00",
    "why_it_governs": "The quick-decision checklist, item 0 included: a decision for the founder goes through a picker with a recommendation, never prose.",
    "how_this_build_will_embody_it": "Ran it. The choice of fix was put to the founder as a picker with the recommendation first, and they selected it; the deploy is put to them the same way rather than performed unasked." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-04T15:42:45+08:00",
    "why_it_governs": "Governing methodology must live in the working tree, not be recalled.",
    "how_this_build_will_embody_it": "Both governing documents are in this tree and were opened here; line ranges in this manifest are the ones actually read." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T15:42:45+08:00",
    "why_it_governs": "A lesson recorded only in prose returns; the class must be encoded where it fails without the author's cooperation.",
    "how_this_build_will_embody_it": "PARTIAL, and named as such. The cause is documented at the read site and the control gate is mutation-proven, but no gate yet forbids a NEW cookie-client read on a Bearer-reachable path. That is the durable guard this class needs, and it is carried as residual BRAIN-R1 rather than claimed." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-24", "read_at": "2026-09-04T15:40:46+08:00",
    "why_it_governs": "Understanding precedes solving; a misdiagnosis fed more force is an error loop. Six causes were guessed at before the real one was reproduced.",
    "how_this_build_will_embody_it": "No code was changed until the 502 was reproduced with a real token and the anon-vs-service read proved the cause. Every disproven hypothesis is recorded in think.md rather than quietly dropped." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-105", "read_at": "2026-09-04T15:40:46+08:00",
    "why_it_governs": "Four-layer gate. This is a layer-1 structural fault (a shared library assumed one transport's auth) that surfaced as a layer-3 continuity break.",
    "how_this_build_will_embody_it": "Fixed at layer 1 where it lives, not papered over at the surface; the roleplay wrap repairs the layer-3 reporting so a failure names itself." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-275", "read_at": "2026-09-04T15:40:46+08:00",
    "why_it_governs": "Diagnose before patching, and STOP rather than retry a failing identification with force.",
    "how_this_build_will_embody_it": "Five hypotheses were abandoned on evidence instead of being attempted; the sixth was proven by reproduction before a line was written." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-04T15:38:06+08:00",
    "why_it_governs": "The control window decides WHETHER guidance runs; this build touches the code that reads its flag.",
    "how_this_build_will_embody_it": "Only the CLIENT that reads the flag changed. evaluateControlGate and the suppression branch are untouched, and mutation-testing re-proves both 'provider NEVER called' tests still fail when suppression is disabled." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-536", "read_at": "2026-09-04T15:40:47+08:00",
    "why_it_governs": "Cross-module composition failures: one taxonomy in one place, not hand-rolled copies that drift.",
    "how_this_build_will_embody_it": "Roleplay returns through the shared llmErrorResponse rather than a new bespoke catch, so its error shape matches every other generative route." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-04T15:40:47+08:00",
    "why_it_governs": "A citation from cached memory is a violation operating undetected.",
    "how_this_build_will_embody_it": "Each section above was re-opened in this session at the stated time before being cited; the commit carries the Session-Reads trailer." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-04T15:40:47+08:00",
    "why_it_governs": "'Verified' names the CANONICAL command, not a self-chosen subset reported in the gate's words.",
    "how_this_build_will_embody_it": "npm run check is run whole and its output pasted in check.md; the parts that CANNOT be verified from the repo (the mobile app's recovery, roleplay's underlying cause) are named as findings F1 and F2 rather than implied fixed." }
]
```
