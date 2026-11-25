---
started_at: 2026-11-25T11:22:53Z
trigger: Gong ledger F33.8 stage 2b — residual R1-service-role-lists of docs/tbc/2026-11-25-hide-by-phrase-stage2; an independent read-only search of service-role call reads.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Service-role lists stop naming hidden calls (stage 2b)

## Design

hiddenInCompanyFrom (one read of the company's hides, then the SQL rule per hidden call) for company-wide lists;
hiddenFrom for given ids. Applied to: coaching inbox, coaching metrics (count, uncoached, requests), session list
(managers), dispute queue, calibration pool and submit, saved coach chats, vendor monitoring list and detail, and the
comment / share-request / score-correction writes. 0340: the rule's admin exemption needs the call's own company.
The [id]/hidden route takes the rule's verdict instead of re-deriving it.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "An independent search found seven service-role paths that still name or quote a hidden call to a manager (coaching inbox, uncoached lists, session list, dispute queue, calibration pool, saved coach chats, vendor monitoring), plus writes to a hidden call's score.",
    "how_this_build_will_embody_it": "Each path consults the database rule before returning or writing; each has a test that fails without the check."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed in full by line at 2026-11-25T11:22:59Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Holistic: a manager gate that admits sales-coach admins who are not company admins makes RLS and service-role reads disagree.",
    "how_this_build_will_embody_it": "Every listed service-role path now asks rss_call_hidden_for for the actual viewer."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Layer 3: an inbox or uncoached list that links to a call the manager can't open is a dead end.",
    "how_this_build_will_embody_it": "Hidden calls leave the lists; the call page itself says why it's hidden."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Look past the task: the SQL rule's admin exemption didn't check the viewer's company, harmless under RLS but wrong for a service-role caller passing another company's admin (vendor staff).",
    "how_this_build_will_embody_it": "0340 adds the company term; replay shows another company's admin is now hidden-from."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "The fix depends on 0340 in production.",
    "how_this_build_will_embody_it": "db:apply applied 0340; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "The [id]/hidden route re-derived 'can see' from ctx.isAdmin and agent_id.",
    "how_this_build_will_embody_it": "It now consumes hiddenFrom's verdict; every new check calls hiddenFrom / hiddenInCompanyFrom, both of which ask rss_call_hidden_for."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Nothing is deleted to hide a call.",
    "how_this_build_will_embody_it": "Filters on read; no rows removed."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Erasure is the only path allowed to delete call data; a hide must narrow who reads the rows without removing any of them, or it would become a second, unaudited erasure.",
    "how_this_build_will_embody_it": "The calls and their data stay; only who may read them narrows."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Scope was the founder's: 'Real hide, in stages'.",
    "how_this_build_will_embody_it": "Stage 2b finishes the named lists; aggregates that name no call are recorded, not silently decided."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new choice taken; feedback-request handling follows the hide (the earlier residual is superseded and recorded)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A hidden-call test per path (inbox, metrics, list, disputes, calibration GET+POST, chats, vendor, comment, share, override)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T11:22:59Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
