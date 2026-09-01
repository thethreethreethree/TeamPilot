---
started_at: 2026-08-29T10:33:00+08:00
---

# THINK — company-aggregate KPI scope (Layer-1 shows the business's numbers)

## Why (founder directive + live data)
Founder, escalating: Layer-1 KPIs still read "building" — "ridiculous". The per-rep view (`/kpi/me`, agent_id=self)
gates until a rep personally has ≥5 outcome-marked sessions, and outcomes are sparse per rep, so it stays empty.
But the founder has asked repeatedly for PER-BUSINESS KPIs. Verified against the live DB: pooled across a company
the data DOES cross the gate — top company: 22 opportunities / 13 resolved / 9 sold → Conversion 40.9%, Close 69%,
Win/loss 2.25 SHOW NOW. So the fix is to let an owner/admin see the COMPANY aggregate, which both populates today
and is literally the "each company its own KPI" ask.

## Understanding (§0, §1.5.2 reuse-the-compute)
The `me` route computes every metric over a set of `rows`. Feeding it the COMPANY's pooled rows (all reps) instead
of one rep's produces the company aggregate from the SAME functions — no new compute, no new gate. RLS already
permits an admin same-company reads (the team route relies on it). So: a `scope=company` param, admin-gated
(ctx.isAdmin), swaps `agent_id = self` for `agent_id in (company's sales-coach members)`; a non-admin falls back to
self, never leaking another business.

## Honesty (§3.4)
Conversion/close/win-loss populate now; **Revenue + Avg-deal-size stay "building" because ZERO sold sessions carry a
deal value** — that is honest (the data isn't there), and the outcome prompt shipped this session captures deal
value on a 'sold', so they fill as reps enter amounts. Not fabricated. The subtitle/deltas still compare the
company's recent-vs-prior, not "your own past" for the individual — acceptable; the toggle labels which view it is.

## The build — reuse the compute, add a scope
- `kpi/me/route.ts` — `GET(req)` reads `scope`; admin + `scope=company` → pool the company's member sessions +
  after-pitch; else self. Returns `scope`. Same metrics.
- `kpi/page.tsx` — a manager (team fetch 200) defaults to `scope=company` with a Company/Mine toggle; the fetch
  carries the scope.

## Verification (A38)
Live-DB gate-check confirms the company-pooled numbers cross MIN_SESSIONS (pasted in check.md). Typecheck clean.
The route's scope branch is founder-visual-verify (no me-route jsdom/route harness) + the live-data proof; RLS
same-company read is the existing, relied-upon policy.

## Session-read manifest (A22 — read_at ≥ started_at 10:33:00; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-29T10:33:02+08:00",
    "why_it_governs": "Diagnose from the record — the company-pooled fix was chosen because the live data proves it crosses the gate.",
    "how_this_build_will_embody_it": "Queried the live DB: 22 opportunities / 9 sold for the top company → Conversion 40.9% shows now." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-29T10:33:06+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md re-opened this session; cited below." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T10:33:10+08:00",
    "why_it_governs": "Layer-2 effectivity — the metric must actually SHOW numbers end-to-end, proven against data.",
    "how_this_build_will_embody_it": "Verified the pooled data crosses MIN_SESSIONS before claiming the fix works." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-08-29T10:33:14+08:00",
    "why_it_governs": "THINK-first — reuse the existing compute over a different row set, don't fork a second KPI engine.",
    "how_this_build_will_embody_it": "Only the fetch scope changes; every metric function is unchanged." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-08-29T10:33:18+08:00",
    "why_it_governs": "Honesty — Revenue stays 'building' because deal values aren't entered; never fabricate one.",
    "how_this_build_will_embody_it": "Revenue/avg-deal honestly gate on zero deal-valued sales; the fix does not fake them." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-08-29T10:33:22+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: proved the fix from data, reused the compute, gated company-scope to admins, kept honesty on revenue." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-29T10:33:26+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-08-29T10:33:30+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-08-29T10:33:34+08:00",
    "why_it_governs": "Gate the lesson — verify against the real artifact rather than assert.",
    "how_this_build_will_embody_it": "The live-DB gate-check is pasted; the scope branch's un-tested half is named founder-visual-verify, not asserted clean." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-08-29T10:33:38+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes the gate + the live-DB numbers; the RLS same-company read is the existing relied-upon policy." }
]
```
