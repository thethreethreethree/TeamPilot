---
started_at: 2026-11-25T21:43:40Z
trigger: Gong ledger F12.7 "Streams" (P2, DIFFERENT); Gong capture 2026-11-22 (blog gong-for-onboarding, OCR).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Follow a saved search and see its new calls

## Design

0342 saved_search_events (follow / unfollow / seen; append-only; owner-only read). savedSearchFollow.ts: followStates
(pure) and newMatches (runCallSearch through the caller's client, from = later of since and the search's own from).
GET saved-searches adds following / newCount / newCapped; POST saved-searches/events. Search page: bell toggle and
"N new" badge; opening marks seen.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Ledger F12.7: a saved search never tells its owner about new matching calls; Gong adds new calls to a saved filter and alerts the person (capture page blog__gong-for-onboarding, OCR).",
    "how_this_build_will_embody_it": "Follow a saved search; it counts calls that matched since you last opened it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T21:43:41Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Holistic: a background matcher on the service role would bypass the reporting tree and the hide rules shipped yesterday.",
    "how_this_build_will_embody_it": "Matching runs on read through the owner's own client; nothing is matched or stored in the background."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Layer 3: a count with no way to the calls is a dead end; opening must clear it.",
    "how_this_build_will_embody_it": "Clicking the search runs it and marks it seen; the badge clears once the server has the record."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Look past the task: a failed run must not read as 'nothing new'; the search's own from-date must still apply.",
    "how_this_build_will_embody_it": "newCount null shows '?'; the later of the search's from and the since is used (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "The feature depends on 0342 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0342; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Which calls match is decided by runCallSearch; who may see them by RLS.",
    "how_this_build_will_embody_it": "newMatches calls runCallSearch with the caller's client; no re-derived matching or access."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Append-only: following, unfollowing and opening are events.",
    "how_this_build_will_embody_it": "saved_search_events with update/delete refused (replayed)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Erasure must keep covering call words; the follow must not store any.",
    "how_this_build_will_embody_it": "Events hold no call content; matching isn't stored."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Guide, don't overtake: the person chooses what to follow.",
    "how_this_build_will_embody_it": "Off by default; a bell per saved search."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; bell-menu alerts deferred and recorded."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Lib, route and render tests; the rls-audit allowlist names the writer."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T21:43:41Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
