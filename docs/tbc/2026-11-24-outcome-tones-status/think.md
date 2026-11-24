---
started_at: 2026-11-24T22:53:34Z
trigger: Gong ledger F26.10 "Outcome colour categories" and F36.34 "Service status page"; founder pickers 2026-11-25 "Green / grey / amber" and "Simple public page".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Outcome colors and a public status page

## The record

- Outcomes: OUTCOME_LABELS (outcomeLabels.ts); door log OUTCOME_BADGE (only Sold colored).
- /api/health: public; backend.supabase.reachable, capabilities.llmReady/email/webhooks; production today: email false,
  webhooks false.

## Design

outcomeTone + OUTCOME_TONE_CLASS; OutcomeBadge in the calls list, recordings, sessions, strategy; door log uses the
tones. /status (public) → StatusView → publicStatus(health).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Ledger F26.10 (only Sold colored) and F36.34 (no status page; /api/health is raw JSON). The founder chose green/grey/amber and a simple public page.",
    "how_this_build_will_embody_it": "One tone rule for every outcome badge; a status page that reads the existing health endpoint."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T22:53:35Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Holistic: outcomes show in five lists and the door log; the door log has its own outcome set.",
    "how_this_build_will_embody_it": "outcomeTone covers both sets (Not interested = the door's no sale); every badge uses OUTCOME_TONE_CLASS."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Layer 2: a customer wondering whether ELOSTATE is down needs one page that says so.",
    "how_this_build_will_embody_it": "/status, public, four plain parts."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Look past the task: configuration that's off (email, webhooks) is not an outage, and a public page must not leak internals.",
    "how_this_build_will_embody_it": "'Not switched on' is its own state; no commit, storage or provider shown (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "The status page makes the two missing configs (email, webhook secret) visible as 'Not switched on'."
  },
  {
    "id": "§1.5.4",
    "source_file": "CLAUDE.md",
    "line_range": "198-210",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "The founder specified the colors (green / grey / amber) — the result, not polish.",
    "how_this_build_will_embody_it": "Exactly those three; no red anywhere (tested)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "One rule each: which tone an outcome has; how health maps to a public part.",
    "how_this_build_will_embody_it": "outcomeTone + OUTCOME_TONE_CLASS; publicStatus."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Guide, don't overtake: colors and publicity were the founder's choices.",
    "how_this_build_will_embody_it": "Two pickers."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Honesty: a failed status check must not read as 'all working'.",
    "how_this_build_will_embody_it": "It says it couldn't check."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Both were pickers."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: tone mapping and no red; status states, no internals, failed check."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T22:53:35Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
