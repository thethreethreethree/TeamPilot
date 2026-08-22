---
started_at: 2026-08-22T11:09:00+08:00
---

# THINK — Prep-up Phase 1: data model + OCR + routes (Team-Sync)

Founder-directed (2026-08-22), design approved (`docs/MEETING-PREPUP-DESIGN.md`). Prep-up = pre-meeting context
(goal + must-discuss topics + documents) that makes the AI Meeting Coach agenda-aware. Phase 1 is the
foundation: data model, document extraction (incl. OCR), and the routes. UI + live-brain + Dissect integration
are later phases.

## Decisions locked with the founder
- **OCR must be token-free + independent of Anthropic.** I TESTED DeepSeek vision → its API rejects images
  (`400 "This model does not support image"`), and Anthropic is out. So images use **Tesseract.js** (a WASM OCR
  engine: no API, no tokens) — VERIFIED locally (OCR'd a rendered text image accurately in ~1.2s). It runs
  SERVER-SIDE so a low-end phone does zero heavy work and the behaviour is identical on web + mobile webapp
  (founder: "no complications"). Text/PDF/DOCX use the already-installed `extractText` (unpdf/jszip — also
  token-free). All extraction is GRACEFUL: a failure stores the facilitator's NOTE alone, the upload never blocks.

## What Phase 1 builds
- **Migration `0238`** (new tables only — no `coaching_sessions` change): `meeting_preps` (goal, topics jsonb with
  live `covered`, status, session_id) + `meeting_prep_documents` (storage_path, kind, note, extracted_text), both
  with company_id tenancy + owner RLS. ⚠ **Founder applies via `npm run db:apply`** (never hand-applied — ledger
  drift). Until applied, the routes simply error if called; NOTHING existing depends on the tables (A34-safe: the
  feature is not wired into any flow yet).
- **`meetingPrep.ts`** data layer — owner-scoped writes via the request client (RLS), brain-side read by
  session_id via admin; INV22 (null on real error, never empty-dressed).
- **`extractImageText.ts`** — the isolated, graceful Tesseract OCR (dynamic import; timeout + char cap).
- **Routes:** `POST /meeting-prep` (create draft), `GET|PATCH /meeting-prep/[id]` (read+docs / update goal+topics),
  `POST /meeting-prep/[id]/document` (sign → direct-to-storage upload → confirm: download + extract + store).
  Reuses the hardened upload stack (allowlist refuses executables/archives, company-pinned path, CWE-209).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "Understanding precedes solving — I TESTED DeepSeek vision + Tesseract before choosing the OCR path.",
    "how_this_build_will_embody_it": "The OCR decision rests on a verified test, not an assumption." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A38 via Read this turn (11:10)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "Layer-1/2 — sound structure (new tables, RLS, isolated OCR) the later phases rest on.",
    "how_this_build_will_embody_it": "New tables only; extraction isolated + graceful; routes reuse the hardened upload." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "Proactive audit — refuse executables/archives, pin the path to the company, degrade gracefully.",
    "how_this_build_will_embody_it": "Allowlist + company-scoped storagePath + note-only fallback, all tested." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "171-190", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "External-config completeness — the migration is a blocking setup step outside the code.",
    "how_this_build_will_embody_it": "0238 is flagged as a founder db:apply precondition; A34-safe until applied (nothing wired)." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: verified the OCR path, traced ripple (new tables, no existing coupling), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Route tests lock the type-allowlist, company-scoping, OCR-vs-extract, and graceful fallback." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T11:10:40+08:00",
    "why_it_governs": "'Verified' names the command you ran — and the OCR was proven by a real local run.",
    "how_this_build_will_embody_it": "Ran the full npm run check; the Tesseract OCR was verified end-to-end locally first." }
]
```
