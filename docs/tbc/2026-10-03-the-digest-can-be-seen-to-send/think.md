---
started_at: 2026-10-03T06:22:00Z
trigger: Founder picker 2026-10-03, "Set up Postmark", after an audit of the scheduled jobs found the weekly digest has never sent an email.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - the digest can be seen to send

## The record

- Vercel logs: weekly-digest-cron 2026-09-28 13:00Z, 200, "Postmark not configured (POSTMARK_SERVER_TOKEN /
  CARE_EMAIL_HOST_DOMAIN) … no email sent". Production has neither variable.
- The digest is email-only (weeklyDigest.ts: sendTransactionalEmail). The condition was written out twice there.
- Other email users: C.A.R.E email replies and inbound email; production has 63 C.A.R.E conversations, all
  `web_widget`. Finance report delivery uses push.

## Design

`emailConfigured()` in a no-import module; the digest (both places) and `/api/health` call it. The setup step is
documented with a verification procedure.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "Understanding precedes solving: why has a 200 job never delivered anything?",
    "how_this_build_will_embody_it": "The run's own log line and production's variables, both read before any change: no token, no domain; the job reports emailConfigured:false and returns 200. Printed in full."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; the gate's opening printed."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-92",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "Layer 2: a founder-requested feature that never delivers has not delivered its result.",
    "how_this_build_will_embody_it": "The digest's code is correct and its job is green; the result (an email in an inbox) has never happened. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-150",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "Audit as you work; look at the neighbours.",
    "how_this_build_will_embody_it": "Found while auditing every scheduled job's real runs, the same pass that found the KPI timeout. Opening printed."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "Outside config is not done until verified or a documented blocking step; fail loud.",
    "how_this_build_will_embody_it": "The Postmark account, DNS and two variables are the founder's step, written with values and a verification procedure, and /api/health now says whether email can send. Printed in full."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-325",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "One verdict, consumed everywhere; no restated copies.",
    "how_this_build_will_embody_it": "The condition was restated twice in weeklyDigest.ts; now emailConfigured() is the one verdict the digest and /api/health both call. Printed in full."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "Item 0: whether this needs the founder's pick; item 1: whether the cause is understood from the record.",
    "how_this_build_will_embody_it": "Postmark was the founder's pick on 2026-10-03; the build only makes it checkable and documents the setup. Items 0-1 printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time; full text read 2026-10-02 03:59:58Z."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-597",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry states its coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "configured.test.ts covers both terms on both sides; the health test fails if the flag stops following them. Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1004",
    "read_at": "2026-10-03T06:22:34Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md; email delivery is not claimed until a digest arrives. Heading printed."
  }
]
```
