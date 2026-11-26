---
started_at: 2026-11-26T00:17:00Z
trigger: Gong ledger F23.8 "Dashboard team and period selectors" (P2, PARTIAL) — the KPI headline cards still cover the company or yourself; the team picker narrows only the per-rep table.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The KPI headline cards follow the team picker

## What the record shows

kpi/page.tsx fetches the headline from /api/coach/kpi/me?scope=company|self; the team picker (145bb0c8) is passed
only to /api/coach/kpi/team. kpi/me pools only for a company admin (ctx.isAdmin, founder 2026-08-29) and falls back
to self otherwise. Reading the page showed the label is computed from the page's own button state
(`isCompany = scope === "company"`), and the page defaults the button to Company for every manager the team route
admits — sales-coach managers who aren't company admins included. Such a manager reads their OWN numbers under
"Your whole team's results, pooled". Root cause: the page re-derives the server's scope decision (§2.2).

## Design

- kpi/me: inside the company view, ?team=<manager> narrows the pooled reps through teamFromRequest (tree check,
  404 for a team the caller can't see); an empty team is zero sessions, never the company or the caller. Response
  adds `team` and `canPool` (= ctx.isAdmin).
- Page: labels from the server's `scope` / `team`; the Company switch shows only when `canPool` isn't false; the
  team pick goes to /me in the company view; the request sequence already guards late answers.
- The company view stays admin-only (no change to the founder's 2026-08-29 rule).

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "The ledger gap (headline ignores the team) led to reading the page, which showed a worse problem: the pooled label is shown over a non-admin's own numbers. The cause is the page re-deriving scope, not a copy error.",
   "how_this_build_will_embody_it": "The label is driven by the server's verdict; a render test reproduces the mislabel against the old rule."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T00:19:26Z, after started_at."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Holistic: kpi/me serves the mobile app too (Bearer); new fields must be additive and the default response unchanged.",
   "how_this_build_will_embody_it": "team/canPool are added fields; no team parameter means exactly the old behaviour (existing tests unchanged)."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Layer 3: picking a team below should change what the cards above say, or the manager compares a team's rows with the company's totals.",
   "how_this_build_will_embody_it": "In the company view the pick narrows the cards, and the header says it is one team's pooled results."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-158", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Search adjacent: the same page shows the Company switch to people the server won't pool for.",
   "how_this_build_will_embody_it": "The switch is shown from canPool."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "No configuration outside the repository.",
   "how_this_build_will_embody_it": "None needed."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-322", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "The server decides whether numbers are pooled (ctx.isAdmin); the page re-derived it from its button and drifted.",
   "how_this_build_will_embody_it": "isCompany = data.scope === 'company'; the switch reads canPool."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "KPIs are derived on read from sessions; nothing is stored or edited.",
   "how_this_build_will_embody_it": "No table or write is added."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Erasure keeps outcomes and scores; KPIs are made of those, with no customer text.",
   "how_this_build_will_embody_it": "No customer text is read or shown; nothing new for erasure to reach."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Never a leaderboard by default: a team view pools, it doesn't rank.",
   "how_this_build_will_embody_it": "The team view is a pooled total; the per-rep table's default order is unchanged."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
   "how_this_build_will_embody_it": "No new decision: who may pool is the founder's 2026-08-29 rule, unchanged."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "The page had no render test; one now pins the label to the server's verdict."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T00:19:26Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
