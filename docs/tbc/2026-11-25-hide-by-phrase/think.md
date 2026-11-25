---
started_at: 2026-11-25T11:02:44Z
trigger: Gong ledger F33.8 "Automatic rules to hide calls" (P2, MISSING); founder pickers 2026-11-25 "Hide by phrase, admin rules" then "Real hide, in stages".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A company phrase hides a call from everyone but its rep and admins (stage 1)

## Design

0337 hide_phrases, hide_phrase_retirements, call_hides, call_unhides (append-only, company-read, mfa_required);
rss_call_hidden_for / rss_call_hidden_from_me; restrictive SELECT `rss_not_hidden` on coaching_sessions and the call's
transcript, brief, score, notes, follow-up drafts, follow-through and snippets. 0338 restates the four tables' RLS as
plain statements so the audits can read it. hidePhrases.ts scans a call when its transcript lands (and after an edit);
adding a phrase checks the last 90 days. Admin panel in Protection; notice + Unhide on the call page; the library and the
granted view refuse hidden calls.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Ledger F33.8: a call with private content (a personal call, an HR matter) can't be kept from managers and the library; the founder chose 'Hide by phrase, admin rules', 'Real hide, in stages'.",
    "how_this_build_will_embody_it": "The database refuses a hidden call's rows to anyone but its rep and admins — not a UI filter."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-25T11:02:53Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Holistic: restrictive SELECT policies on coaching_sessions and six call tables touch every authenticated reader of a call.",
    "how_this_build_will_embody_it": "Replayed signed-in as manager/rep/admin before, during and after a hide; service-role paths (library, shared) check hiddenFrom explicitly."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Layer 3: a manager who opens a hidden call must not land on a blank 'not found' with no reason; an admin must reach the unhide.",
    "how_this_build_will_embody_it": "HiddenCallNotice on the call page says why to whom it's hidden; the rep/admin read a banner; admins get Unhide."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Look past the task: the grants view and the library read through the service role, past RLS; a backfill read failure must not read as 'no calls'.",
    "how_this_build_will_embody_it": "Both call hiddenFrom (grant test: a grant doesn't open a hidden call); a failed backfill read returns checking:null and the panel says so."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "The hide depends on migrations applied in production.",
    "how_this_build_will_embody_it": "0337 and 0338 applied by db:apply; verify:live 33 hold."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "'Is this call hidden from this viewer' must be one decision.",
    "how_this_build_will_embody_it": "rss_call_hidden_for in SQL is the authority; RLS uses it via rss_call_hidden_from_me and the service-role routes call it by rpc through hiddenFrom — no TS re-derivation."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Append-only: retiring a phrase or unhiding a call must not erase that the hide happened.",
    "how_this_build_will_embody_it": "hide_phrase_retirements and call_unhides; DB rules refuse update/delete on all four tables."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Legal erasure must keep covering the call's words.",
    "how_this_build_will_embody_it": "call_hides stores the admin's phrase only, never transcript text; listed in erasureCoverage with that reason."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Guide, don't overtake: whether and how far to hide was the founder's decision.",
    "how_this_build_will_embody_it": "Pickers 'Hide by phrase, admin rules' and 'Real hide, in stages'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The scope was a picker; stage 2 is listed, not decided silently."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The hide is an RLS policy plus route tests; the rls-audit blind spot for dynamic SQL is closed by restating it statically (0338)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T11:02:53Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
