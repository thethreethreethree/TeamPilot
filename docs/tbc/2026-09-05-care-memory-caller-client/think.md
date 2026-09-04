---
started_at: 2026-09-05T02:41:06+08:00
---

# THINK - the C.A.R.E extension's coach had no memory of anyone, silently

## Why (the record)
Nobody reported this. The two builds before it fixed the same class after every AI
feature in the Sales Coach app failed, and their closures carried a residual: other
library modules resolve their own cookie client, unswept.

That residual was closed with a flawed method. The earlier sweep checked DIRECT
route imports, which is exactly how the roleplay outage was missed - its path ran
route -> claude.ts -> brain, one hop further than the sweep looked. So the sweep
was rebuilt to walk the whole import graph, and the honest answer changed.

## Understanding (SS0 - measured, not inferred)
A route is at risk when it accepts a BEARER token (so a caller with no cookies can
reach it) AND transitively reaches a library module that resolves its own COOKIE
client. Walking the graph over 331 routes:

  Bearer-accepting routes           : 35
  ...reaching a cookie-only library : 17

Most collapsed on inspection, and one of the collapses was my own error: the first
run counted `careAgentAuth` as a Bearer mechanism, which made every route importing
it look at-risk. Reading it, `requireCareAgent()` is cookie-only with no Bearer path
at all - so those 37 were web routes and the heuristic was circular. Corrected, the
list fell to three modules, two already fixed (brain, doorlog), and `brain`'s only
remaining cookie use is `unlockControlGate`, whose single caller is a web admin route.

ONE genuine case survived: `src/lib/coach/v5/memory.ts`, reached by
`care/extension/coach`, which authenticates with `guardExtensionRequest` - Bearer,
no cookies.

## What it did
`loadCoachMemory()` resolved its own client with `createClient()`, read the session
from cookies, found nobody, and returned EMPTY_SNAPSHOT. `renderMemoryForPrompt`
then returned null, because its rule is `totalAnalyses < 3 && totalGraded < 5` ->
"not enough signal - better silent than wrong".

So every C.A.R.E extension coach call ran with NO `USER PATTERN HISTORY` in its
prompt. Not degraded - absent. The memory was in the database the whole time; the
client could not see it, and the code concluded there was none.

## Why this one matters more than its size
This is the same shape as the door tracker's confident zero - an unknown dressed as
a zero - but what it silently switched off is the product thesis. SS3.4 requires
behaviour "derived from each team's accumulated data" and refuses a system that
"behaved identically for every customer on install". SS3.6 is blunter: "Continuous
adaptation the user cannot perceive is indistinguishable from stagnation. A value
curve nobody can see is, commercially, a flat line."

For extension users the curve was not merely invisible. It was flat.

## SS1.5.1 layers
- Layer 1: a library chose its own transport while its caller had a better one.
- Layer 2: the feature returned 200 and answered as though the user were new.
- Layer 3: nothing downstream could detect it. No error, no log, no test.

## Session-Reads (A22 / SS3.1.2)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-24", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "Understanding precedes solving. The previous answer to this question was produced by a method already known to fail.",
    "how_this_build_will_embody_it": "The sweep was rebuilt transitively before any conclusion was drawn, and my own circular heuristic was caught and corrected before a single file changed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session, not cited from cache.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md were re-opened for THIS build after its started_at; the earlier builds' timestamps are not reused." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "Holistic: never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "`db` is OPTIONAL, so every web caller keeps the cookie session unchanged - pinned by its own test rather than assumed." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-105", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "Four-layer gate. Layer 2: the route returned 200 and delivered coaching built on nothing.",
    "how_this_build_will_embody_it": "Fixed at the library where the client is chosen, not by patching the prompt at the surface." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "Proactive audit: sweep the surfaces adjacent to the one just touched.",
    "how_this_build_will_embody_it": "This build exists only because a residual was swept instead of closed, and it found a live defect in a DIFFERENT product from the one being worked on." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-275", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "Diagnose before patching; a repeated failure means the identification was wrong.",
    "how_this_build_will_embody_it": "The earlier 'none are reachable' conclusion was treated as a failed identification and re-derived, rather than defended." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "Behaviour must be derived from each team's accumulated data; a system identical for every customer on install is refused by name.",
    "how_this_build_will_embody_it": "That is precisely what the bug produced for extension users. The fix restores the accumulated read; the test asserts a real snapshot rather than the empty one." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-05T02:41:16+08:00",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "A test asserts the prompt block EXISTS for a caller with history, because the block is the only place that adaptation becomes perceptible." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-05T02:41:08+08:00",
    "why_it_governs": "The checklist, item 0 included: a decision for the founder goes through a picker with a recommendation.",
    "how_this_build_will_embody_it": "Ran it. Whether to touch C.A.R.E at all was put to the founder as a picker before any edit, because it is a different product from the one being shipped." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-05T02:41:17+08:00",
    "why_it_governs": "Governing methodology lives in the working tree.",
    "how_this_build_will_embody_it": "Both documents are in this tree and were opened here; the line ranges are the ones actually read." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-536", "read_at": "2026-09-05T02:41:17+08:00",
    "why_it_governs": "Audits within modules miss failures ACROSS them.",
    "how_this_build_will_embody_it": "This is that failure twice over: the route and its library disagreed about who resolves the client, and the sweep that should have caught it only looked one module deep." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-05T02:41:17+08:00",
    "why_it_governs": "Citations without session-reading are violations operating undetected.",
    "how_this_build_will_embody_it": "Every clause here was re-opened for this build; the commit carries the Session-Reads trailer." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-700", "read_at": "2026-09-05T02:41:17+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept.",
    "how_this_build_will_embody_it": "The class was swept transitively across all 331 routes and the surviving members are named individually in check.md, not summarised." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-05T02:41:17+08:00",
    "why_it_governs": "A lesson in prose returns; the class must be encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "GATE. memory.callerClient.test.ts mocks createClient to THROW, so a fallback to the cookie session fails by name. Mutation-proven: reverting the one line fails three named tests." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-05T02:41:17+08:00",
    "why_it_governs": "'Verified' names the canonical command, not a self-chosen subset.",
    "how_this_build_will_embody_it": "npm run check is run whole and pasted in check.md - including an honest note that one earlier suite run reported a failure that could not be identified, rather than reporting only the clean runs." }
]
```
