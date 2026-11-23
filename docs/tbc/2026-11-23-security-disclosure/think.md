---
started_at: 2026-11-23T07:05:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, vulnerability disclosure (gong.io capture M36 "Submit discovered security or privacy issues to Gong", graded LACK: "No security.txt or disclosure process").
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Vulnerability disclosure

## The record

- No /.well-known/security.txt and no disclosure page (grade note).
- In-app feedback (0018, /api/feedback) requires sign-in and belongs to a customer company — a researcher has neither.
- Founder-only surfaces: requireVendorAdmin (API) and isVendorAdmin + notFound() layouts (admin/monitoring).
- No alert channel reaches the founders outside the Sales Coach bell; email sending exists only inside C.A.R.E.

## Outside view

A disclosure path fails if a report lands somewhere nobody reads; if the form becomes a spam or abuse channel; if it
quietly collects personal data (IP, contact) beyond need; if reports are readable by customer admins; or if the page
promises legal protection nobody decided to give.

## Design

1. 0312: sealed, append-only security_reports and security_report_events (RLS, no policy; service role only).
2. Public POST /api/security-report (no account; rate limit; hidden bot field; no IP) and /security page with the form.
3. /.well-known/security.txt (RFC 9116) pointing Contact and Policy at /security.
4. Founders' inbox /dashboard/admin/security (vendor-only layout + sidebar), statuses as events.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Understand before building: how feedback works (company-scoped, sign-in required), how vendor-only surfaces are gated (requireVendorAdmin, notFound layouts) and what the capture says were read first.",
    "how_this_build_will_embody_it": "The record section names each; the design follows from 'researchers have no account'."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Layer 3: a report must reach someone who acts on it, and the reporter must know it arrived.",
    "how_this_build_will_embody_it": "The reporter gets a reference; the founders' sidebar has a Security reports inbox with statuses. No push alert yet (R1)."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Holistic: a public write route and sealed tables touch the route-auth, RLS and tenant invariants.",
    "how_this_build_will_embody_it": "Each gate was satisfied with a stated reason (public by design; no tenant exists), not bypassed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Look past the task: a public form invites abuse and personal data.",
    "how_this_build_will_embody_it": "Rate limit + hidden bot field; no IP stored; contact is optional and the page says what is kept."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "security.txt names the production domain, which the repo cannot verify by itself.",
    "how_this_build_will_embody_it": "Domain elostate.com used across the repo (39 uses); the after-push check is to open /.well-known/security.txt and /security live (R2)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Founder-only access is decided once, by isVendorAdmin.",
    "how_this_build_will_embody_it": "The layout uses isVendorAdmin and the API requireVendorAdmin — the same predicate."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Reports and triage are facts over time.",
    "how_this_build_will_embody_it": "Both tables are append-only (rules replayed); status is the latest event."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not used here; a reporter asking to be forgotten is filed (R3) rather than given an ad-hoc delete."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Guide, don't overtake: the founders decide what a report means.",
    "how_this_build_will_embody_it": "The inbox records the founders' status choice; nothing is auto-closed."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Honesty: the page must not promise what the process does not do.",
    "how_this_build_will_embody_it": "It states where reports go and what is kept, and makes no legal safe-harbour promise (founders' decision, R4)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new choice was taken for the founders: safe-harbour wording is filed for them, not written."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Sealing, append-only and validation are replayed; routes are tested; the invariants now list both tables with reasons."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T07:46:07Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
