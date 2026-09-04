---
started_at: 2026-09-04T15:50:00+08:00
---

# THINK - the door tracker was dead from the app, and it reported a confident zero

## Why (the record)
Nobody reported this. The previous build fixed the same class in `lib/brain` after every AI
feature in the mobile app failed, and its closure carried residual BRAIN-R1: ten further
cookie-client reads under `src/lib`, unswept. SS1.5.2 requires the sweep, so it was run
rather than deferred - and it found a whole feature that was silently broken.

## Understanding (SS0 - measured, not inferred)
`src/lib/data/doorlog.ts` is reached by four routes, three of which the mobile app calls:
`door-log`, `todays-metrics`, `my-training`. Every rep-facing function in it built its own
client with `createClient()`, which resolves a session from COOKIES.

`door-log/route.ts` line 79 resolves `callerScopedDb(req)` correctly and passes it nowhere.
The helpers discard it and build their own. So for a Bearer caller every one of them ran
ANONYMOUS, RLS returned nothing, and the writes were refused.

Measured against production, read-only, in the same minute:

```
service key : door_knocks for this rep on 2026-08-31 -> 8 rows, 5 of them "sold"
Bearer token: GET /door-log?date=2026-08-31          -> 200 {"doorsKnocked":0,"sold":0,
                                                             "goBacks":0,"notInterested":0}
```

Eight knocks and five sales, reported as zero, with a 200.

## The read is worse than the write
A refused WRITE returns 500 "Could not log the knock." - the route checks for it (line 138)
and the app's offline queue keeps the knock on the phone and retries. Loud, and no data lost.

A refused READ is indistinguishable from a quiet day at the doors. There is no error, no
retry, no signal of any kind - just a confident nothing for a day the rep sold five. That is
SS3.4 broken at the surface a rep checks most, and it is the reason this build exists.

## SS1.5.1 layers
- Layer 1: a route and the library it calls disagreed about who resolves the client (A21).
- Layer 2: the feature returned 200 and delivered a wrong number - worse than an error.
- Layer 3: nothing downstream could detect it. Every route test passed.

## Session-Reads (A22 / SS3.1.2)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-24", "read_at": "2026-09-04T15:55:14+08:00",
    "why_it_governs": "Understanding precedes solving. The instance was found by sweeping a proven class, then measured against production before a line changed.",
    "how_this_build_will_embody_it": "The zero was proven false by reading door_knocks with the service key and the route with a Bearer token in the same minute, before the fix was written." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session, not cited from cache.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md were re-opened for THIS build at the times recorded here, not carried over from the earlier build in the same session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "68-77", "read_at": "2026-09-04T15:55:14+08:00",
    "why_it_governs": "Holistic: never fix one thing in a way that silently breaks another; trace ripple before acting.",
    "how_this_build_will_embody_it": "`db` is OPTIONAL at every signature, so every existing web caller keeps the cookie client and its behaviour unchanged. A test pins that half of the contract explicitly." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-105", "read_at": "2026-09-04T15:55:15+08:00",
    "why_it_governs": "Four-layer gate. Layer 2: the feature returned 200 and delivered a wrong number, which is worse than returning nothing.",
    "how_this_build_will_embody_it": "Fixed at the data layer where the client is chosen, not by patching each route's display." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-04T15:55:15+08:00",
    "why_it_governs": "Proactive audit: sweep the surfaces adjacent to the one just touched.",
    "how_this_build_will_embody_it": "This build exists ONLY because of that sweep. Nobody reported the door tracker; it was found by asking which other libraries carried the cookie-client assumption that had just taken the coach offline." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-275", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "Diagnose before patching; state the root cause and why it produces this symptom.",
    "how_this_build_will_embody_it": "The route resolves callerScopedDb and then calls helpers that build their own cookie client. That is the cause, and it is named at the call site." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "Honesty is the moat: never present a number the system cannot stand behind.",
    "how_this_build_will_embody_it": "The defect WAS this clause broken - a confident 0 for a day holding eight knocks and five sales. The fix restores the real number; the test's fixture returns non-zero rows so a regression shows up as the zero itself." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "The quick-decision checklist, item 0 included: decisions reach the founder as a picker with a recommendation.",
    "how_this_build_will_embody_it": "Ran it. The deploy of the previous build was put to the founder as a picker; this build's deploy is put to them the same way rather than pushed unasked." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "Governing methodology lives in the working tree.",
    "how_this_build_will_embody_it": "Both documents are in this tree and were opened here; the line ranges are the ones actually read." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-536", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "Audits within modules miss failures ACROSS them - a route and the library it calls disagreeing about who resolves the client.",
    "how_this_build_will_embody_it": "This is precisely that failure: door-log/route.ts resolved the caller's client correctly and doorlog.ts silently discarded it. Every route test passed and the feature was dead." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "Citations without session-reading are violations operating undetected.",
    "how_this_build_will_embody_it": "Every clause here was re-opened for THIS build after its started_at; the commit carries the Session-Reads trailer." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-700", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept.",
    "how_this_build_will_embody_it": "The coach 502 was the report. Sweeping its class found the door tracker, which nobody had reported. The remaining members of the class are enumerated with their reachability in check.md F2 rather than left as 'others may exist'." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T15:55:15+08:00",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "GATE, not a promise this time. doorlog.callerClient.test.ts mocks createClient to THROW, so any rep-facing function that reaches for the cookie client fails by name. Mutation-proven: reverting getKpiForDay fails the named test." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-04T15:55:22+08:00",
    "why_it_governs": "'Verified' names the canonical command, not a self-chosen subset.",
    "how_this_build_will_embody_it": "npm run check is run whole and pasted in check.md. What cannot be verified from the repo - the app's recovery after deploy - is named as a finding rather than implied." }
]
```
