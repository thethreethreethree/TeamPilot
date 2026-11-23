---
started_at: 2026-11-23T21:38:42Z
trigger: OPEN.md ask-pipeline "pipeline questions are not saved as a chat thread"; founder picker 2026-11-23 "Follow-ups, not stored".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Pipeline Ask: follow-ups on the page

## The record

- ask-pipeline route → askPipeline → askCoachTurn with the pipeline context and one question.
- Ask Coach over calls stores chats (ask_coach_chats/turns, 0281) and erasure reaches them (0285/0316).

## Outside view

A conversation is the point of asking; storing it would add a place customer names live. The founder chose the
conversation without the storage.

## Design

askPipeline takes history (cleanHistory: last 4, trimmed) and puts it before the new question (historyBlock). The Ask
box keeps a thread in page state, sends it back, shows it, clears it on "New conversation" or a scope change, and
says it isn't saved.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Understand before building: the Ask box answered one question and forgot it; its answers name customers, so saving threads would create a new store of customer names erasure would have to reach.",
    "how_this_build_will_embody_it": "The founder chose follow-ups on the page, not stored; the page sends earlier turns back."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:51:19Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Layer 3: 'what should I say to them?' only works if the coach knows who 'them' was.",
    "how_this_build_will_embody_it": "Earlier turns go with each follow-up; the thread is shown; 'New conversation' starts over."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Holistic: the route reads the pipeline through the caller's client and calls the AI once per question; the prompt grows with history.",
    "how_this_build_will_embody_it": "At most 4 earlier turns, each trimmed (cleanHistory); switching whose pipeline clears the thread."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Look past the task: history comes from the browser, so it can't be trusted as instructions.",
    "how_this_build_will_embody_it": "Marked in the prompt as context, not instructions, under CONVERSATION_IS_DATA; only the caller's own answer is affected."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "How much history is used must be decided once, server-side, whatever the page sends.",
    "how_this_build_will_embody_it": "cleanHistory in askPipeline.ts is the only trimming; the route applies it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Nothing new is recorded: the founder chose not to store conversations.",
    "how_this_build_will_embody_it": "No table, no row; the thread lives only in the page's state."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Legal erasure must reach every stored copy of a customer's words; not storing the thread means there is no new copy.",
    "how_this_build_will_embody_it": "Answers are never saved; erasure needs nothing new (stated in the decision)."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Guide, don't overtake: the person drives the conversation; the coach answers in context.",
    "how_this_build_will_embody_it": "Follow-ups only when asked; the person can start a new conversation at any time."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Honesty: a person should know the conversation won't be there tomorrow.",
    "how_this_build_will_embody_it": "'This conversation isn't saved.' under the thread."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Asked as a picker (storing customer names vs not); founder chose 'Follow-ups, not stored' — logged in DECISIONS-2026-11-22.md."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "cleanHistory/historyBlock unit tests; render test sends earlier turns, shows the thread, clears on New conversation."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:51:19Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
