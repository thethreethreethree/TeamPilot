# Prep-up — Design (for founder approval, 2026-08-22)

> Pre-meeting context capture that makes the AI Meeting Coach **agenda-aware**: the facilitator loads the goal,
> the must-discuss topics, and supporting documents BEFORE the meeting; the coach then hints at uncovered topics,
> nudges on drift, and alerts if a must-discuss topic hasn't been raised before the meeting ends. It also
> sharpens the post-meeting Dissect ("did we hit the goal + the agenda?").

## 1. What it collects (founder spec)
1. **Relevant documents** — uploads: images (each with a NOTE), common text files (txt/md/csv/docx), and PDF.
2. **The ultimate goal / focus** of the meeting (free text).
3. **A list of must-discuss topics** (ordered items).

## 2. Data model (new — needs migration `0238`)
- **`meeting_preps`**: `id, company_id, created_by, goal text, topics jsonb` (array of `{id, text, covered:boolean}`),
  `status` ('draft'|'active'|'done'), `session_id uuid null` (set when the meeting starts), `created_at, updated_at`.
- **`meeting_prep_documents`**: `id, prep_id, storage_path, filename, kind` ('image'|'text'|'pdf'), `note text`
  (the facilitator's note — the AI signal for images), `extracted_text text` (for text/pdf/docx via `extractText`),
  `created_at`.
- **Link:** the meeting session (a `coaching_sessions` row) finds its prep by `meeting_preps.session_id` — so NO
  change to `coaching_sessions` (keeps the shared table untouched; only new tables).
- RLS: company-scoped + owner (the facilitator) — mirrors the meeting-session gates.

## 3. Uploads (reuse the hardened stack)
- Reuses the existing file-upload hardening: auth-first, `maxDuration`, per-file size cap, MIME/extension
  allowlist, decompression-bomb guard, CWE-209; large files go client→storage via a signed upload target
  (the ~4.5 MB body-cap pattern already in the Door Log).
- **Images (OCR — founder-directed 2026-08-22):** DeepSeek vision was TESTED and its API rejects images
  (`400 "This model does not support image"`), and Anthropic is out — so OCR uses **Tesseract.js** (a WASM OCR
  engine: token-free, no API, no Anthropic). VERIFIED locally: OCR'd a rendered text image accurately in ~1.2s.
  Runs **SERVER-SIDE** (in the upload confirm route) so a low-end phone does zero heavy work and it behaves
  identically on the website + mobile webapp (founder: "no complications on web + mobile"). The image is OCR'd →
  `extracted_text`, combined with the facilitator's **note**. Isolated in `extractImageText` + **graceful
  fallback**: OCR fails/empty → the note is still stored, the upload never blocks (no user-facing complication).
- **Text / PDF / DOCX:** `extractText` (unpdf / jszip — already installed, also token-free) → `extracted_text`.
- The prep's "document context" fed to the AI = the notes + extracted text, condensed/capped for the prompt.

## 4. Live brain integration (the core value)
- The cue route (`meeting-session/[id]/cue`) loads the prep by `session_id` and passes an **agenda context** to
  the strategy: `{ goal, topics: [{text, covered}], docContext }`.
- `buildMeetingCueUserMessage` is extended to render the agenda (goal + topic list with covered/uncovered marks +
  a short doc-context) alongside the rolling transcript. The meeting brain then:
  - **Hint:** surface the next uncovered must-discuss topic at a natural gap.
  - **Drift nudge:** when the recent discussion is off the goal/topics, nudge back (a new `drift` trigger).
  - **Unaddressed-before-end alert:** on the existing `nearingEnd` signal, if a must-discuss topic is still
    uncovered → an `uncovered_topic` cue naming it. (Vocab additions stay meeting-only — the §6 no-sales-leak
    rule + the existing trigger gate still apply.)
- **Topic coverage tracking:** a running `covered` set on the prep's topics, updated as the meeting progresses (a
  lightweight per-pass assessment marks a topic covered once it's clearly discussed). This drives both the live
  "what's left" and the end-of-meeting alert, and it's persisted so the UI can show a live checklist.
  *(Open decision B: per-cue-pass coverage vs a periodic coverage pass — see below.)*

## 5. Dissect integration
- The post-meeting Dissect prompt receives the prep (goal + topics + final coverage). The Dissect then measures
  **agenda coverage** (which must-discuss topics were covered vs missed) and **goal attainment** — a stronger
  §3.5 consequence measure than today's decisions/actions alone. Fully additive to the current Dissect.

## 6. UI flow
`Meeting Coach → "New Meeting" → PREP-UP screen` (goal textarea · add/remove topics · upload docs with an
extracted-text/note preview) `→ "Start Meeting"` (creates the session linked to the prep) `→ live
MeetingCoachingPanel` (agenda-aware cues + an optional live topic checklist showing covered/uncovered) `→ Stop →
Dissect` (agenda coverage). A saved draft prep can be started later.

## 7. Build phases (each its own TBC + gate-green commit)
1. **Data + routes:** migration `0238` (the two tables) + data layer + prep create/update + upload route (reusing
   the hardened stack + `extractText`).
2. **Prep-up UI:** goal + topics + uploads + "Start Meeting".
3. **Live agenda brain:** agenda into the cue prompt + coverage tracking + drift/hint/uncovered-before-end.
4. **Dissect agenda coverage.**
5. **Flow + nav wire-in** (folds into the Team-Sync go-live).

## Open decisions for you (before I build)
- **A — Images:** v1 = store image + facilitator note (the note is the AI signal), no OCR. Add OCR later if
  needed. (Recommended: note-only v1 — fast, no new OCR infra; the note is usually clearer than OCR anyway.)
- **B — Coverage tracking cost:** (i) assess coverage cheaply on each cue pass (more current, more LLM calls), or
  (ii) a periodic/every-N-turns coverage pass + always at `nearingEnd` (cheaper). Recommended: (ii).
- **C — Is Prep-up required to start a meeting, or optional?** Recommended: OPTIONAL — a meeting can start with no
  prep (today's behavior), and Prep-up simply makes the coach agenda-aware when present. (No regression for a
  quick huddle.)
