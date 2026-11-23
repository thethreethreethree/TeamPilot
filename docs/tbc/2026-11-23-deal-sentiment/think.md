---
started_at: 2026-11-23T09:28:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, sentiment on deals (gong.io capture M36 "AI flags at-risk deals from sentiment", graded PARTIAL: per-call warming/cooling, nothing on prospects/deals).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Deal sentiment

## The record

- Per-call: coach.session_moments_generated events (subject sales_session:<id>, payload.moments[].sentiment
  warming/cooling/neutral); netSentimentFromMoments (sessionFlag.ts) gives a call's net reading; used by session flags.
- Production: 363 moments events; 205 cooling / 182 warming / 514 neutral moments; 0 rows in remote_prospect_calls.
- events RLS: company_id = auth_company_id() (+ 0309 mfa_required).

## Outside view

A deal sentiment fails if it averages unrelated calls, reads a stale version of a call's moments, shows "neutral" when
nothing was read, or slows every pipeline-adjacent page.

## Design

dealSentiment.ts: per prospect, each linked call's latest moments → net reading, ordered in time → last reading and
trend; read in batches of 100 calls; null on failure. listProspects({ sentiment: true }) for the pipeline list and the
Ask box; dealRisk gains "cooled"; a sentiment line on each row.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Understand before building: where per-call sentiment already lives (coach.session_moments_generated events, netSentimentFromMoments) and its real shape in production were read first.",
    "how_this_build_will_embody_it": "Payload keys and sentiment values were counted on production (205 cooling, 182 warming, 514 neutral) before trusting the parser."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Layer 3: a sentiment reading should lead to action, not sit as decoration.",
    "how_this_build_will_embody_it": "A customer who cooled is a deal-risk reason, so it feeds 'At risk', the Forecast view and the Ask box."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Holistic: listProspects is shared by five routes; adding reads to all of them would slow pages that don't show sentiment.",
    "how_this_build_will_embody_it": "Sentiment is opt-in (pipeline list and Ask box only); the calendar, day and stage routes are unchanged."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Look past the task: production has 0 calls linked to prospects.",
    "how_this_build_will_embody_it": "Said in the closure: nothing shows until reps link calls; no reading is invented."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: existing tables only."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "One sentiment reading per call, the same everywhere.",
    "how_this_build_will_embody_it": "extractSessionSignals → netSentimentFromMoments, the function the session flags already use."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Derived state must come from the record.",
    "how_this_build_will_embody_it": "Computed on read from the stored moments; nothing written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "A cooling reading must invite a next step, not a verdict on the rep.",
    "how_this_build_will_embody_it": "Worded as the customer's sentiment and listed with other checkable reasons."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Honesty: no reading is not 'neutral'.",
    "how_this_build_will_embody_it": "No line is shown until a linked call has a reading; a failed read fails the pipeline load."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: extends the deal-risk rule with a stated reason."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Trend, latest-per-call, batching, fail-loud and the new risk reason are tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T09:28:32Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
