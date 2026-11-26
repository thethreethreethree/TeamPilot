---
started_at: 2026-11-26T00:38:55Z
trigger: Gong ledger F11.4 "Preview against a sample" (P2, PARTIAL) — "Still missing: draft trackers (a tracker is live once added)".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Draft trackers

Timing note: the sections were printed at 00:33:04 (previous build) and again at 2026-11-26T00:58:32Z, after this build's code was
written; the manifest records the later read.

## What the record shows

0276: a tracker's words never change; the one allowed change is switching it off. A tracker is matched from the
moment it is added (trackerScan / smartTrackerScan read `active = true`), and a smart one reads back the manager's
last 10 calls at once (one AI read each). So a manager who wants to try phrases has the preview (the form's words, 100
recent calls, nothing stored), but can't keep a tracker without it running. "live" was written as `.eq("active", true)`
in four readers (both scans, the adoption board, the smart cap).

## Design

- 0352: `draft boolean not null default false` (every existing tracker stays live); the guard allows draft → live once,
  never back; keyword_trackers_live (security_invoker) = active and not draft — the one definition of live (§2.2),
  read by both scans, the adoption board and the smart cap. Coverage keeps switched-off trackers (they have hits) and
  drops drafts (they never ran).
- Route: POST {draft: true} saves without the smart cap or backfill; PATCH {id, action: "publish"} puts a draft live
  (only a draft still on, in the company; 404 otherwise), checks the smart cap, then runs the same backfill as create
  (extracted, unchanged). GET hides drafts from non-managers; Search's tracker filter drops drafts.
- UI: "Save as draft"; a "Draft" chip; "Go live"; "Copy to form" (words never change, so a draft is adjusted by copying
  it into the form, previewing, saving anew, switching the old one off).

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "The gap is that adding a tracker switches it on; reading the scans showed 'live' written four times as active = true, so a draft flag added in one place would leak in the others.",
   "how_this_build_will_embody_it": "A view defines live once and the readers move to it."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed in full at 00:33:04 and 2026-11-26T00:58:32Z."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "Holistic: the scans run in the call pipeline; reading a view that doesn't exist yet would break every scan.",
   "how_this_build_will_embody_it": "0352 is applied to production before the code is pushed."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "Layer 3: a draft must lead somewhere — live, or into a new draft — not sit as a dead row.",
   "how_this_build_will_embody_it": "Go live and Copy to form on every draft row (render-tested)."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-158", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "Adjacent: the smart cap, the Search filter and coverage all list trackers.",
   "how_this_build_will_embody_it": "The cap counts live only (and is checked on going live), Search hides drafts, coverage drops them."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "No configuration outside the repository; the migration is the precondition.",
   "how_this_build_will_embody_it": "Applied and verified (db:apply + verify:live) before deploy."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-316", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "'Is this tracker live' must be one verdict, not active = true repeated with a draft term added to some copies.",
   "how_this_build_will_embody_it": "keyword_trackers_live is that verdict, in SQL."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "A tracker's words never change (0276) — past hits keep their meaning.",
   "how_this_build_will_embody_it": "The guard still refuses word changes; a draft can't be edited either, only copied."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "Tracker phrases are a company's words, not a customer's; drafts have no hits.",
   "how_this_build_will_embody_it": "Nothing new for erasure to reach."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "The manager decides when a tracker is right; the system doesn't run it on their behalf until then.",
   "how_this_build_will_embody_it": "A draft runs nothing — no matches, no AI reads."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
   "how_this_build_will_embody_it": "No new decision: drafts are the ledger's named gap, built with 0276's rules."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id here was printed at its line range this session."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "The trigger enforces draft → live only; replay and route/UI tests pin it."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T00:58:32Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
