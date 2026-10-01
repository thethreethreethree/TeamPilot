---
started_at: 2026-10-01T15:00:00Z
trigger: An unauthenticated smoke of the 44 route references the app makes (mobile plan Phase 0, step 4) found GET after-pitch answering 200 with an empty summary to a caller who is not signed in.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - not signed in is not empty

## The record

53 unauthenticated calls to production, one per method the route file exports. 33 answered 401/403/405.
19 answered 400: those routes validate the body before the login, so an empty body is refused first; the app
always sends a valid body, so an expired login still reaches the 401. One answered **200**:
`GET /api/coach/sales-session/<id>/after-pitch` returned `{"summary":null,"isOwner":false}` with no login, and its
POST returned 404. No data leaked (RLS hid the session), but "nothing here" is the wrong answer to "not signed in",
and the route's own comment records the 10 September incident where this shape hid a rep's own scores in the app.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The 200 was read, then the route: it answered an RLS-empty read as 'no summary', and its own comment records the 10 September incident of the same shape. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashed in the front matter. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "Four layers; layer 2 is what the app shows a rep with an expired login.",
    "how_this_build_will_embody_it": "The app already turns a 401 from this route into an auth explanation; the route now gives it one instead of an empty review. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "Audit as you work; check the routes a dependent relies on.",
    "how_this_build_will_embody_it": "Found by calling every route the app uses, unauthenticated, as Phase 0's production-smoke step. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No founder decision: a correctness fix to an auth answer. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Openings printed at the recorded time; full text read at 05:03Z today."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "Citation needs an in-session read.",
    "how_this_build_will_embody_it": "read_at is the print time; what each print covered is stated."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "The route test now asserts 401 for both methods (mutation caught); the smoke script is kept to re-run."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-01T15:06:46Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check by name, with its exit code, in check.md; the smoke's output is pasted."
  }
]
```
