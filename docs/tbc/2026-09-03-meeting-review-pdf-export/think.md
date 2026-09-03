---
started_at: 2026-09-03T10:20:00+08:00
---

# THINK — Meeting Review PDF export (+ close the dissect drift-guard)

## Why (founder directive — a user-SPECIFIED experience, §1.5.4/AMD-012)
Founder: "add an export to PDF for the meeting coach review so I can share it with my team … make it visually
appealing … clear indicators … break it apart so the reader can easily understand all the important information."
The founder named the EXPERIENCE (visual appeal, clear indicators, structured) as the deliverable — so the design
is **layer-2 (the intended result)**, not waivable layer-4 polish. Shipping a monochrome/plain export would be the
§1.5.4 under-deliver failure (the exact AMD-012 lesson). So the design is built AND verified visually.

## Understanding (§0)
The review data already exists (the dissect: decisions, actions+owners, open items, effectiveness, agenda,
overall). The task is a SHARE surface for it. The app already exports the schedule as a colour PDF via a
self-contained print doc + window.print() + print-color-adjust:exact (AMD-012's own fix). Mirror that pattern
(§1.5.2 reuse the reference implementation), but with a designed TEXT layout, not canvas.

## The build
- `buildMeetingReviewHtml` (PURE, unit-tested): a self-contained, inline-styled document — navy header band with
  title+date, a summary callout, quick-read INDICATOR chips (Focused/Drifted, balance, and the owner-less-actions
  alarm), then colour-accented sections broken apart: Decisions (numbered), Action items (each with an owner pill;
  owner-less flagged red — the #1 meeting failure), Left open, Agenda coverage (covered ✓ / missed ✗). All
  model/transcript text HTML-ESCAPED (untrusted). print-color-adjust:exact so it prints in colour.
- `exportMeetingReviewPdf`: opens the doc in a new window + prints (Save-as-PDF); returns false on a popup block so
  the UI shows an actionable hint (no silent no-op).
- Wired an "Export PDF" button into MeetingReview (shown when there's content); the server page passes the
  meeting title + date for the header.
- **Completeness (not a bandaid):** added the DISS-R1 drift-guard test — generateMeetingDissect must call
  dissectCoachV5 with the non-reasoning model (A30 — encode the lesson so a refactor can't silently re-starve long
  meetings). Updated Jeff's product knowledge with Meeting Coach + the shareable PDF (standing rule: every feature).

## Verification (§1.5.1 layer-2, A38)
Rendered the doc with the founder's REAL dissect via headless Chrome → PDF and READ it (visual proof): navy header,
summary, green "Focused / Every action owned" chips, ✅ Decisions [6] numbered, 📍 Action items [1] with owner pill,
🔓 Left open [4], footer. Fixed a print html-background gray on review. typecheck clean; PDF builder 6 tests + the
drift-guard + the meeting suite green.

## Session-read manifest (A22 — read_at ≥ started_at 10:20; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T10:28:20+08:00",
    "why_it_governs": "Understanding precedes solving — the review data exists; the task is a share surface for it.",
    "how_this_build_will_embody_it": "Reused the existing dissect data + the app's proven print-PDF pattern rather than a new pipeline." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T10:28:23+08:00",
    "why_it_governs": "Methodology in the tree, consulted this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; cited axioms re-opened this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T10:28:26+08:00",
    "why_it_governs": "Layer-2 effectivity — the export must actually look good + carry the info, proven.",
    "how_this_build_will_embody_it": "Rendered with real data + READ the PDF; not 'the code runs'." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T10:28:29+08:00",
    "why_it_governs": "Reuse the reference implementation (the schedule colour-PDF export).",
    "how_this_build_will_embody_it": "Mirrored the self-contained print doc + print-color-adjust:exact pattern." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "162-190", "read_at": "2026-09-03T10:28:32+08:00",
    "why_it_governs": "A user-SPECIFIED experience is layer-2, not waivable polish (AMD-012).",
    "how_this_build_will_embody_it": "Built the visual design the founder specified + verified it visually before calling it done." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T10:28:35+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Traced the reuse, verified visually, escaped untrusted text, updated Jeff, closed the drift-guard." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T10:28:38+08:00",
    "why_it_governs": "Retrospective identification (carried from the same incident's prior commits).",
    "how_this_build_will_embody_it": "This ships alongside the recording + dissect fixes diagnosed from the live record." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T10:28:41+08:00",
    "why_it_governs": "Single-source decisions (carried from the dissect fix in range).",
    "how_this_build_will_embody_it": "The drift-guard test pins the single model-selection decision so it can't fork." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T10:28:44+08:00",
    "why_it_governs": "Honesty — the empty state is honest, and the export never fabricates content.",
    "how_this_build_will_embody_it": "The PDF renders the honest empty state when a meeting produced nothing; it only formats the real dissect." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T10:28:47+08:00",
    "why_it_governs": "Recurring-failure honesty; don't ship polish that hides substance.",
    "how_this_build_will_embody_it": "Verified the design visually before claiming done; the drift-guard prevents the dissect regression from returning." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T10:28:17+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before citing." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T10:28:17+08:00",
    "why_it_governs": "Citations require session-reading.",
    "how_this_build_will_embody_it": "Manifest pairs each cited § with a fresh read_at; commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T10:28:17+08:00",
    "why_it_governs": "A lesson in prose recurs — encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Added the DISS-R1 drift-guard test pinning the non-reasoning model for the meeting dissect." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T10:28:17+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes the render + Read visual proof, the typecheck, and the test runs." }
]
```
