---
started_at: 2026-11-25T23:39:25Z
trigger: Two reviews on 26 Nov found service-role routes leaking hidden calls; the class needs a gate.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - An audit check: service-role call reads must check hides

## Design

Invariant 43 in scripts/invariant-audit.mjs: an API route using createAdminClient that reads coaching_sessions,
coaching_transcript_segments_current or pitch_scores references hiddenFrom / hiddenInCompanyFrom /
hiddenCallsForCompany, or is in HIDE_ROUTE_ALLOWLIST with a reason; stale entries fail.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "The hide (0337) is enforced by RLS, which the service role bypasses; seven service-role routes leaked hidden calls until a review found them, and nothing stops the eighth.",
    "how_this_build_will_embody_it": "Invariant 43: a service-role route reading calls must check hides or say why it can't reach one."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T23:39:26Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "Holistic: 22 existing routes read calls with the service role without a hide helper; each needs its own reason, not a blanket pass.",
    "how_this_build_will_embody_it": "Each listed with why (cron, owner-only write, in-person only, admin only, counts only, caller-client gate)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "Layer 1: the structure must make the safe path the default for the next route.",
    "how_this_build_will_embody_it": "The audit fails a new route until it filters or is justified."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "Look past the task: two routes looked risky (pitch-score, prospect calls).",
    "how_this_build_will_embody_it": "Read both: each opens the call through the caller's client first; listed with that reason."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "Routes must consume the hide verdict (hiddenFrom → rss_call_hidden_for), not re-derive it.",
    "how_this_build_will_embody_it": "The invariant asks for the helpers, which ask the SQL rule."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "An audit reads code; no data changes.",
    "how_this_build_will_embody_it": "No migration."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "Erasure is admin-only and may see hidden calls; it is listed, not exempted silently.",
    "how_this_build_will_embody_it": "Listed with its reason."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "No product behaviour change.",
    "how_this_build_will_embody_it": "Audit only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "The hide leak class was found by review twice; it needs a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Invariant 43, mutation-checked (removing the helper from a route → a violation)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T23:39:26Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
