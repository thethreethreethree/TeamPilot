---
started_at: 2026-11-26T07:05:00Z
trigger: Gong ledger F13.2 (P2, LACK) — "brief types as templates".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Brief templates: a manager's questions, answered from a call

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Ledger F13.2: Gong lets admins define brief types (sections of questions with instructions); every summary engine here runs a fixed prompt, so a manager who needs 'budget, decision process, timeline' from every call has to read each call themselves.",
    "how_this_build_will_embody_it": "A manager writes a template of questions; anyone who can open a call runs it and gets an answer per question, each citing its lines."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T10:03:16Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Holistic: answers quote the customer, so they are personal data — legal erasure, hidden calls and the reporting tree must all reach them, as they reach the call brief.",
    "how_this_build_will_embody_it": "custom_briefs: the brief's read rule, 0341's hidden-call rule, MFA, and rss_erase_sessions deletes them (0351's body + one line, diffed)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Layer 3: the manager writes templates where they coach (Coaching); the rep or manager runs one where they review the call (its page); a citation plays the call from there.",
    "how_this_build_will_embody_it": "Editor on Coaching; 'Briefs' on the call page; citations are play buttons."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Adjacent: running the same template twice on the same transcript must not spend twice or show two different answers.",
    "how_this_build_will_embody_it": "Stored once per (call, template, transcript version); a stored run is returned as is."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "0364 applied in production; verify:live passed. The AI call depends on the account's provider keys (as every engine).",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Who may brief a call is the call's own read rule: the route opens it through the caller's client, and refuses before any AI spend.",
    "how_this_build_will_embody_it": "getSession(id, callerClient) → 404 before the model is called (tested)."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "A template never changes (retire and write again); a stored answer is never edited.",
    "how_this_build_will_embody_it": "Guard trigger on templates; no-update/no-delete rules on answers, yielding only to erasure."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Answers can quote the customer.",
    "how_this_build_will_embody_it": "rss_erase_sessions deletes custom_briefs; ERASURE_EXTENSIONS lists 0364 with why."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "The manager chooses the questions; the system answers only from what was said and says when it wasn't discussed.",
    "how_this_build_will_embody_it": "NOT_DISCUSSED for any uncited answer; no invented facts (parseAnswers)."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Month-1 control: the call brief is a factual read, exempt from the guidance gate; a template's answers are the same kind of read (what was said), not advice to the rep.",
    "how_this_build_will_embody_it": "customBriefCoach controlExempt like callBriefCoach; no coaching advice in the prompt."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers. Running a brief is on demand (a person clicks), so it spends only when asked — no pipeline cost.",
    "how_this_build_will_embody_it": "No automatic runs; no new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "No citation — and no allowlist reason — without reading the route.",
    "how_this_build_will_embody_it": "The templates-route allowlist reason was written from the route as built."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: uncited answers become 'not discussed'; no AI spend on a call the caller can't open; retired templates refused; the screens."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T10:03:16Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
