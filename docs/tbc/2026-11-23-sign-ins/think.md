---
started_at: 2026-11-23T22:00:30Z
trigger: OPEN.md usage "sign-ins via Google/Microsoft or the mobile app aren't counted … email lookup is one call per person".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Count every sign-in in team usage

## The record

- usage route: login_attempts by email (written only by the web form), one getUserById per person for emails.
- Production, 30 days, counts only: auth.sessions 5 (3 people); login_attempts 2; auth.audit_log_entries 0;
  identities: email only.

## Outside view

The mobile app and any social sign-in bypass the web form, so the view undercounts exactly the people who use the
product away from a desk.

## Design

0327 rss_sign_in_times (service role; sessions + form records, by user id, company-pinned). usage.ts mergeSignIns (one
sign-in recorded in both within 2 minutes counts once). Route uses one RPC instead of the per-person lookup.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Understand before building: the usage view counted login_attempts only (the web password form). Measured in production (30 days): auth.sessions 5 sign-ins (3 people), login_attempts 2, auth.audit_log_entries empty, identities all email.",
    "how_this_build_will_embody_it": "Read both sources by user id inside the database and count one sign-in recorded twice once."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T22:03:07Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Layer 2: a manager reading 'sign-ins' for a rep who uses the mobile app saw zero — a wrong number, not a missing feature.",
    "how_this_build_will_embody_it": "Mobile, Google and Microsoft sign-ins now count."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Holistic: the usage route paged per person to look up emails (one call each); the tenant allowlist held a reason for the old read.",
    "how_this_build_will_embody_it": "One database call replaces the per-person lookup; the stale allowlist entry is removed (the audit flagged it)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Look past the task: auth.sessions loses a row on sign-out, so it alone would undercount too.",
    "how_this_build_will_embody_it": "Both sources merged; the count is a lower bound, never inflated (stated in the migration)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0327 applied to production; grants and counts read back live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "What counts as one sign-in is decided once.",
    "how_this_build_will_embody_it": "usage.ts mergeSignIns, tested; the route only consumes it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "The usage view is derived from records already on file; counting sign-ins better must not create or change any.",
    "how_this_build_will_embody_it": "No new table; reads existing records."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Sign-in times name no customer."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Guide, don't overtake: usage is a manager's read, not an action on the rep.",
    "how_this_build_will_embody_it": "Counts only; emails never sent to the browser (tested)."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Honesty: a usage figure that silently omits a sign-in method is a confident undercount.",
    "how_this_build_will_embody_it": "All methods counted; a failed read is a 500, never a lower number (tested)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "mergeSignIns unit test; route tests (mobile sign-in counts; failed read 500; company+people only); production read-back."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T22:03:07Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
