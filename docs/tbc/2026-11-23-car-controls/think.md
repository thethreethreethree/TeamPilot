---
started_at: 2026-11-23T22:07:15Z
trigger: Founder 2026-11-23 "keep building everything in the list" — ledger F30.8 "Listen in the car" (LACK).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Lock-screen and car controls for recorded calls

## The record

- Players: RemoteCallPanel (Remote Sales call page) and RecordingsTab's Player (Sales Coach recordings), each an
  <audio> element.
- useTapControls uses Media Session for live-coaching earbud taps (its own screen).

## Outside view

The Media Session API is what lock screens, car displays and headphones talk to; wiring it makes "listen in the car"
real without an app.

## Design

useCallMediaSession(audio, { title, artist, ready }) + mediaActions; neutral title; cleared on unmount.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Understand before building: ledger F30.8 (LACK) — 'no CarPlay/Media Session support'; the call players are plain <audio> elements; useTapControls already uses Media Session but only on the live-coaching screen.",
    "how_this_build_will_embody_it": "A small hook for the two call players, using the standard Media Session API."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T22:08:32Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Layer 3: a rep reviewing calls on the road needs the lock screen and car controls to drive playback, not the phone screen.",
    "how_this_build_will_embody_it": "Play, pause, ±15 s and seeking from the lock screen, car display or headphones."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Holistic: Media Session is one per page; the live-coaching tap controls also set handlers.",
    "how_this_build_will_embody_it": "Handlers are set only while a recording plays and cleared on unmount; the live screen is a different page."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Look past the task: a lock screen or car display is visible to others.",
    "how_this_build_will_embody_it": "The title is a neutral 'Recorded call' — never the customer's name."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "How each control moves the recording is decided once.",
    "how_this_build_will_embody_it": "mediaActions (tested) is the only mapping; both players use it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Playback controls change nothing stored; listening is still recorded by the player's own events.",
    "how_this_build_will_embody_it": "No writes added; the players' listen tracking is unchanged."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched; no customer data leaves the page."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Guide, don't overtake: the person drives playback.",
    "how_this_build_will_embody_it": "Controls only; nothing plays on its own."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Honesty: support varies by device and browser.",
    "how_this_build_will_embody_it": "Where the API is missing, the hook does nothing; the record states it is best-effort."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: a ledger LACK item; the privacy choice (no customer name) follows §3.1.1's intent."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "mediaActions unit test (±15 s clamped, seekto clamped, play/pause)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T22:08:32Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
