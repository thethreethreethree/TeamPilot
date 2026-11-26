---
started_at: 2026-11-26T01:04:30Z
trigger: Independent review of 3f6e9411..1f47fcb9 (bell placement, followed searches in the bell, draft trackers) — two confirmed medium, one confirmed low, one nit.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the fifth review

Timing note: started_at is when the review arrived; the fixes were written before the sections were re-printed at
2026-11-26T01:06:19Z (previous print 00:58:32). The manifest records the later read.

## What the review found, from the record

1. Two bells in the Sales Coach shell on every screen: the sidebar bell (`hidden md:flex`) and the phone chip
   (`md:hidden`) are both mounted — CSS hides, React still mounts. The browser shares one Supabase client, and
   realtime-js returns the existing channel for a repeated name, so the second bell's `.on()` after `subscribe()`
   threw (swallowed) and that bell got no live updates; both polled. My 3d541696 test checked "a bell is mounted", not
   "one bell".
2. A bell link clicked while already on Search: client navigation doesn't remount the page; its mount-only effect
   never re-reads the URL, so neither the filters nor "seen" applied, and the bell's item came back at the next poll.
3. The phone chip covered the KPI page's period switch.
4. Nit: a second "Go live" on a smart tracker at the cap answered 409 (cap) instead of 404 (already live).

## Design

1. useIsDesktop (matchMedia) → exactly one bell: sidebar (desktop, expanded), the collapsed strip (desktop, collapsed,
   small), the tab bar's last cell (phone, panel opening upward). Each mount also gets its own channel name (useId).
2. Already on Search → load the link fresh; the Search page fires FOLLOW_SEEN_EVENT after "seen" lands; the bell reloads.
3. Solved by 1 (no floating chip).
4. The publish read checks draft and active before the cap.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Each finding was traced to its cause before the fix: CSS-hidden components stay mounted; a shared client returns a channel by name; a mount-only effect can't see a same-page navigation.",
   "how_this_build_will_embody_it": "The fixes address those causes (one mount, unique channel, fresh load), not the symptoms."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed in full at 00:58:32 and 2026-11-26T01:06:19Z."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Holistic: the bell's placement interacts with every Sales Coach page's header and the tab bar.",
   "how_this_build_will_embody_it": "The phone bell moves into the tab bar, which no page draws over."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Layer 2: a bell that receives no live updates, and a link that doesn't open what it says, fail the intended result.",
   "how_this_build_will_embody_it": "One bell with its own channel; the link loads fresh when needed; render tests for one bell on each screen."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-158", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "The earlier test checked presence, not count — a test that passes on the defect.",
   "how_this_build_will_embody_it": "The new test asserts exactly one bell on desktop, phone and collapsed, and fails on the old shell."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Realtime is Supabase config; the 60 s poll covers it being off.",
   "how_this_build_will_embody_it": "No new external dependency."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-316", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Which bell shows is one decision (screen size), made once, not two CSS rules each mounting its own copy.",
   "how_this_build_will_embody_it": "useIsDesktop decides; each placement branches on it."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "The bell reads append-only notices and saved-search events; moving where it mounts must not add a write or change what is recorded.",
   "how_this_build_will_embody_it": "No table or write is added."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Erasure reaches notification excerpts (0316); the bell now shows them to their recipient only, as before, and stores no new copy.",
   "how_this_build_will_embody_it": "Nothing new for erasure to reach."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "The bell must not sit over the controls a person is using.",
   "how_this_build_will_embody_it": "It lives in the tab bar on phones."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
   "how_this_build_will_embody_it": "No new decision."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id here was printed at its line range this session."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "SalesCoachShell.bell.render.test.tsx counts bells; a route test pins the 404."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T01:06:19Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
