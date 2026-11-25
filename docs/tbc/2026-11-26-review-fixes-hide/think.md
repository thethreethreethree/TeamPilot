---
started_at: 2026-11-25T22:25:41Z
trigger: Independent code review of cf00f7b9..e72905e5 (26 Nov 2026): 8 findings, no cross-company leak.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Fixes from the 26 Nov review

## Design

0345: rss_hidden_calls_for_me filtered to the caller's company; rss_hidden_subjects_for_me also covers 'pitch:<id>';
rss_hidden_calls_for(company, viewer) for service-role routes. hidePhrases.ts: paged reads, chunked ids, one paged RPC.
hide-phrases GET paged. Follow: "new" = calls that ended since (endedAfter, internal); 'new?' when capped. CoachingInbox
clears state on a team change.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "An independent review (26 Nov) of the last nine commits found unpaged reads that let long calls escape a hide, a per-platform cost in every hidden-set check, dispute notes of hidden calls readable through events, follow counts that miss calls still processing or capped, and an inbox that kept the previous team's numbers.",
    "how_this_build_will_embody_it": "Each finding fixed at its cause, with a test or replay that fails without the fix."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:25:42Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Holistic: rss_hidden_calls_for_me is in every hide policy (about 25 tables); changing it changes every signed-in read.",
    "how_this_build_will_embody_it": "Same results (replayed: manager/rep/other company), filtered to the caller's company first."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Layer 2: a followed search that says nothing when the count couldn't finish misleads; a team switch that keeps old numbers misleads.",
    "how_this_build_will_embody_it": "'new?' when the count is a floor; the inbox clears before each team load."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Look past the task: the 1000-row cap and long .in() lists are the same class in every new read.",
    "how_this_build_will_embody_it": "All hide reads paged and id lists chunked (150)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "The fixes depend on 0345 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0345; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "The hide verdict must stay single-source.",
    "how_this_build_will_embody_it": "rss_hidden_calls_for and the subjects set both judge each call with rss_call_hidden_for."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Events are append-only and company-readable; a hide must narrow reads of them, not change them.",
    "how_this_build_will_embody_it": "A read-rule change only."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Erasure is untouched by these read rules.",
    "how_this_build_will_embody_it": "No deletes or updates."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Guide, don't overtake: no behaviour change beyond the fixes.",
    "how_this_build_will_embody_it": "Counts and hides behave as designed, now at any scale."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; the coverage-link rounding is recorded, not changed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "The capped-read class keeps returning; it needs gates where it bit.",
    "how_this_build_will_embody_it": "Tests: 1,200-line transcript hides; one paged RPC; capped follow; inbox team switch."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:25:42Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
