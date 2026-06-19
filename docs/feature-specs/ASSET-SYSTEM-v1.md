# Asset System v1 — Locked Spec (post red-pen)

**Status:** RED-PEN ROUND 1 INCORPORATED. Phase 0 (schema) authorized.
**Author:** Agent, under CLAUDE.md + ThinkerThinker.md + AMD-006.
**Date:** 2026-06-19 (revised after founder red-pen).
**Companion specs:** `CONVERSATION-SEARCH-v1.md`, `FOLDER-SYSTEM-v1.md` — both load on top of this schema, sharing the phase plan.

## Founder red-pen — what changed from the v1-draft (Section 5)

| Question | Original draft | Locked after red-pen |
| --- | --- | --- |
| Departments per file | one | **MULTIPLE** (many-to-many) |
| Tasks per file | one primary | **MULTIPLE tags** (many-to-many) |
| Classification field shape | title + description | **title + short description + tag chips** |
| Blocked file types | executables, archives | **videos blocked** also |
| Permissions model | company-wide visibility only | **Role-based gate** (everyone / admins / CEO+admins / specific-people). Uploader **always** sees own file per §A10. |
| C.A.R.E customer uploads | deferred to v2 | **IN v1** — 10MB cap, images+PDF only, auto-classified to conversation, customer filename = title |
| Casual cap trigger | "uploader picks casual lane" | **AUTOMATIC** — any file missing department OR description OR task counts toward the 3/day cap |
| Department seed list | 5 seeded names | **EMPTY at signup** — admins create at `/dashboard/settings/departments` |
| Retrieval surface | inline + library page | **inline + library + auto-folder navigation + cross-conversation search** (last two are companion specs) |

> Per §0 (Understanding precedes solving) and A2 (Design backwards from the §4 readout),
> the goal here is to earn understanding of WHAT this feature is, WHY it is built this
> way, and HOW we will know it works — BEFORE any line of code. The founder asked for
> Option B: best-judgment defaults proposed as a written spec, red-pen, then build. This
> doc is the proposal.

---

## 0. What the founder asked for (mirror)

> A file-upload system across **Tasks**, **Team Chat**, and **C.A.R.E agent chat**.
>
> Every uploaded file is defined by three things:
> 1. **Which department** does it belong to
> 2. **Which task** is it related to
> 3. **What is the file about**
>
> Drag-and-drop. Retrievable (the user can find files they uploaded weeks ago).
> `@person` share preserves the classification. Viewer always shows the three fields.
>
> Escape hatch — the **cat-pic exception**: unimportant sharing (a meme, a cute photo,
> nothing of asset value) can skip classification, but **hard-capped at 3/day per user**.
> The cap is the structural defense against drift into "everything is casual."

---

## 1. Constitutional reframe — this is NOT a file-storage feature

A file-storage feature ends at "the bytes are in a bucket and the URL is in a row."
That framing produces a file graveyard — most files uploaded, never retrieved, never
cited, never reused. The team's storage cost compounds; the team's knowledge does not.

The founder's three-field requirement is the tell. The classification fields are not
metadata; **they are §3.2 Understanding Gate applied to assets**. They force the
uploader to articulate what the file IS, just as the task gate forces articulation of
what work IS. The same structural defense against unmoored work applies to assets.

So the right frame: **the Asset System is the §3.1 chain applied to files.**

- **Events are immutable.** `file.uploaded`, `file.classified`, `file.viewed`,
  `file.downloaded`, `file.shared`, `file.cited`, `file.deprecated`. Every interaction
  with a file leaves a chain event. The file's "state" (active, deprecated, hot, cold,
  cited-N-times) is derived from event replay, never edited.
- **Classification is the gate (§3.2).** A file can be UPLOADED without classification
  (it has to exist somewhere to be classified). It cannot be **SHARED** without
  classification, OR it must explicitly take the casual lane and consume one of the
  user's 3/day allowance. The lane choice is the gate.
- **Files become §1.1 reusable assets.** A file cited in a task, a decision dialogue,
  or a resolution feeds back into future work. The library surface reads the chain
  event history to answer "what assets have we built up that pertain to this?".
- **A11 mirror — System counts, user decides.** The Coach-shaped AI does NOT
  auto-classify. It SUGGESTS classification (citing the surrounding task/topic/chat
  context as evidence) and the user confirms. The user always renders the verdict.
- **A10 no shadow read.** Every user sees who has viewed/downloaded their files.
  Every user sees what the System suggested as their classification.
- **A8 growth participant.** The library surface answers "what has the team learned?"
  via assets, not "what files exist?". Empty library state isn't a void — it's the
  System asking what the team intends to build up.

---

## 2. The §4 readout — backwards-design (A2)

Before writing the schema, name what would PROVE this works vs. ship a file graveyard.

**Hard metrics (objective, defensible):**
- **Re-retrieval rate.** % of files retrieved (viewed or downloaded) by anyone at any
  point AFTER upload day. Target: > 40% within 30 days. Graveyard signal: < 15%.
- **Cross-actor retrieval.** % of files retrieved by someone OTHER than the uploader.
  This is the asset-value signal — files only the uploader ever opens aren't team
  assets; they're personal storage. Target: > 25% within 30 days.
- **Citation rate.** % of files referenced (via `@file` mention) from a task, decision
  dialogue, or resolution within 60 days of upload. This is the §1.1 close-the-loop
  signal — a file that gets cited has fed back into reasoning. Target: > 10%.
- **Casual-share concentration.** Distribution of casual-lane uploads per user per
  week. Healthy: long tail (most users 0–3 casuals/week). Pathological: a small
  cluster maxing out 3/day consistently — the cap exists but isn't actually
  deterring; or a cluster never using casual — they're either disciplined or they're
  classifying meaningless files. Both extremes warrant a §4 conversation.

**Differentiated metric — communication-quality variant for assets:**
- **Classification accuracy revisited.** When the System suggests "this file is about X"
  and the user changes it, log the delta. The delta over time tells us whether the
  System's reads are converging or drifting. Per §3.5, the metric is anchored to
  DOWNSTREAM CONSEQUENCE (was the corrected classification more useful — i.e.,
  retrieved later by someone — than the System's suggested one?), not to whether the
  user accepted the System's suggestion. **Measuring adoption would be grading our
  own homework — forbidden.**

**A3 reminder:** the System must NOT default to "auto-classify accepted." That would
contaminate the A/B by removing the user's agency from the loop. Default: System
suggests; user clicks Accept or edits. Either is fine. The point is the user touched
the field.

---

## 3. The A6 triad — three pillars, ship none alone

A6 says the Tasks triad (Understanding / Accountability / Guidance) only works as a
loop. The Asset System has the same shape:

| Pillar | Asset-system form | Failure mode if shipped alone |
| --- | --- | --- |
| **Classification** (the gate) | The 3 fields + casual escape hatch | Bureaucracy: users hate it because nothing useful happens with the data they entered |
| **Retrieval** (find it later) | Library page + inline access + search by all 3 fields | Lost archive: classified files vanish into a list nobody opens |
| **Reuse** (asset compounds) | `@file` citation in tasks/decisions/resolutions + view trail + cross-team `@person` share | Personal storage: classified, findable, but only by the uploader — no team value |

**Implication for the build:** all three pillars ship together in v1, or v1 doesn't
ship. The phased build below respects this — each phase moves all three forward
together for one surface at a time, never one pillar for all surfaces.

---

## 4. AMD-006 four-layer build evaluation

Layers in order (foundation up). Each layer below rests on the previous; the order is
the sieve.

### Layer 1 — Build structure (the schema + storage)

**`files` table (the asset row).**
```
id                  uuid pk
company_id          uuid fk → companies(id)            -- multi-tenant
uploader_id         uuid fk → profiles(id)             -- who put it here
storage_path        text                                -- Supabase Storage path
mime_type           text
size_bytes          bigint
original_filename   text                                -- as the user named it
title               text                                -- "what is the file about" (line 1)
description         text                                -- short description (≤500 chars)
access_role         text CHECK IN (
                      'everyone',                       -- default; any active company member
                      'admins',                         -- admins + CEO + COO
                      'ceo_admins',                     -- CEO + COO + admins (alias for clarity)
                      'specific_people'                 -- whitelist in file_access_grants
                    ) DEFAULT 'everyone'
classification_lane text CHECK IN ('classified', 'casual') -- derived; classified iff fields complete
classified_at       timestamptz                         -- when the gate cleared (NULL if casual)
uploaded_via        text CHECK IN (
                      'agent_dashboard',                -- via TeamPilot dashboard
                      'customer_widget'                 -- via C.A.R.E widget visitor upload
                    ) DEFAULT 'agent_dashboard'
linked_conversation_id uuid fk → support_conversations(id) NULL  -- C.A.R.E context
linked_topic_id     uuid fk → chat_topics(id) NULL     -- team chat context
deprecated_at       timestamptz                         -- soft-delete (per §3.1, NEVER hard-delete)
created_at          timestamptz default now()
```

Note: No `department_id` / `task_id` columns on `files` itself. Both are MANY-TO-MANY via join tables below — a file can belong to multiple departments AND tag multiple tasks. Per the founder's red-pen.

**`file_departments` (join table — many-to-many).**
```
file_id        uuid fk → files(id)        on delete cascade
department_id  uuid fk → departments(id)  on delete cascade
created_at     timestamptz default now()
primary key (file_id, department_id)
```

**`file_tasks` (join table — many-to-many).**
```
file_id      uuid fk → files(id)   on delete cascade
task_id      uuid fk → tasks(id)   on delete cascade
created_at   timestamptz default now()
primary key (file_id, task_id)
```

**`file_tags` (the chip system).**
```
file_id     uuid fk → files(id) on delete cascade
tag         text                                 -- normalized lowercase; ≤40 chars
created_at  timestamptz default now()
primary key (file_id, tag)
```

**`file_access_grants` (used when `access_role = 'specific_people'`).**
```
file_id      uuid fk → files(id)        on delete cascade
profile_id   uuid fk → profiles(id)     on delete cascade
granted_by   uuid fk → profiles(id)     on delete set null
granted_at   timestamptz default now()
primary key (file_id, profile_id)
```

**Casual-lane derivation (NOT stored — derived).** A file is `classified` iff it has:
1. At least one row in `file_departments`, AND
2. Non-empty `description`, AND
3. At least one row in `file_tasks`.

Otherwise it's `casual` and counts toward the user's 3/day cap. The `classification_lane`
column is a derived materialized field (updated by trigger on insert + on join-table
write) so the cap-check query is O(1). Per A12, the trigger is CREATE OR REPLACE and
the column has a default that the trigger overwrites.

**`departments` table (new).**
```
id           uuid pk
company_id   uuid fk → companies(id)
name         text                  -- "Engineering", "Customer Success", "Operations"
description  text                  -- optional, helps the System suggest later
created_by   uuid fk → profiles(id)
created_at   timestamptz default now()
```

Admin-managed at first (CEO/COO/admin can create). Defer "anyone can create" until §4
readout shows a need.

**`file_classification_suggestions` table (A10 transparency).**
```
file_id              uuid fk → files(id)
suggested_department uuid fk → departments(id)  NULL
suggested_task       uuid fk → tasks(id)        NULL
suggested_title      text                       NULL
suggested_at         timestamptz default now()
accepted             boolean                    NULL  -- null=pending, true/false=decided
accepted_at          timestamptz                NULL
```

This is the audit trail of System suggestions for A10 (user can see what System read
about them) and the §4 readout instrumentation (accuracy delta over time, anchored to
downstream retrieval consequence not user acceptance).

**`file_events` view → `events` table.** Re-use the existing `events` table per §3.1.
New event kinds:
- `asset.file.uploaded`
- `asset.file.classified` (with payload of all 3 fields)
- `asset.file.viewed`
- `asset.file.downloaded`
- `asset.file.shared` (with target user)
- `asset.file.cited` (when a file is `@file`-mentioned)
- `asset.file.deprecated`

**Casual-share counter — derived, NOT stored.**
A separate counter table is a §A12 footgun (every counter is a partial-state surface).
Instead: derive "casual files this user uploaded today" from `files` where
`uploader_id=$me AND classification_lane='casual' AND created_at >= start_of_day(UTC)`.
The cap check is a runtime query. The user's local-day-vs-UTC trade-off is named below
(open uncertainty O3).

**Supabase Storage bucket.** Single bucket `assets-v1`, paths shaped as
`{company_id}/{year}/{month}/{file_id}.{ext}`. RLS at the storage layer + RLS at the
`files` table layer (both check `company_id` against `auth.uid()`'s company membership).

**RLS policies on `files`:**
- SELECT: any active member of the same `company_id`. **Department-level scoping is
  deferred** — see open uncertainty O5.
- INSERT: any active member of the company.
- UPDATE: uploader OR admin can edit classification fields; nobody can edit
  storage_path, size_bytes, mime_type (those are immutable once uploaded).
- DELETE: forbidden at the row level. Use `deprecated_at` (per §3.1 append-only).

### Layer 2 — Operational effectivity (does it actually work end-to-end?)

The walking-skeleton test for v1:
1. User on `/dashboard/operations/{id}` drags a PDF onto the task gate
2. Upload succeeds; classification modal opens with System-suggested fields
   (department inferred from task's owner department; task pre-filled to current
   task; title pre-filled from filename)
3. User confirms (or edits) and clicks "Save as classified"
4. The file appears in the task's "Assets" tab
5. Another user opens the same task, sees the file, downloads it
6. The downloader receives the file; a `file.downloaded` event is appended
7. Uploader opens the file's "who's seen this" view and sees the downloader's name
   + timestamp

If any step in that chain breaks, layer 2 fails and nothing else matters.

### Layer 3 — Synergetic composition (does it leave the workflow flowing?)

Per AMD-006 §1.5.1 — for each surface, trace what the user does immediately BEFORE
and AFTER the file interaction:

**Tasks:**
- Before: user is in the gate or task detail context. They know the task ID.
- During: drop file → classification pre-fills with task context.
- After: file is in the task. Next action: keep working on the task.
- **Composition test:** does the user stay in the task flow? YES — file uploader UI is
  inline in the task, no modal that yanks them out.

**Team Chat (`/dashboard/chats/[id]`):**
- Before: user is composing a reply in a topic.
- During: drop file → topic + topic's task (if linked) pre-fill the classification.
- After: file appears as a message in the thread. Next action: continue the chat.
- **Composition test:** PASSES — file lives in-thread, classification is glanceable
  on the message bubble.

**C.A.R.E (agent reply composer):**
- Before: agent is drafting a customer reply.
- During: agent attaches a file (e.g., a how-to PDF, a screenshot).
- After: file is sent to customer; customer can download it via the widget.
- **Composition test:** PASSES, with caveat — see open uncertainty O8 (customer
  upload from widget is OUT of scope for v1).

**Cross-surface composition (the @ share):**
- User in Team Chat types `@file annual-budget.pdf` → autocomplete from library →
  inserts a reference message → the recipient is notified.
- The classification chip travels with the reference (the recipient sees department +
  task + title at a glance before clicking through).

### Layer 4 — User interface and design

**Upload affordance** — three states for the dropzone:
- **Idle:** thin dashed border with "📎 Drop a file or click to upload" — visible but
  recessed so it doesn't compete with the composer.
- **Drag-over:** border lights up brand ember; text changes to "Drop to upload."
- **Uploading:** progress bar + filename + cancel X.

**Classification modal — appears after upload completes:**
- Header: "Classify this asset" + thumbnail / filename
- Three fields:
  1. **Department** — dropdown of company's departments; System pre-suggests one with
     a 💡 hint "Suggested from this task's owner department" the user can accept or
     change. NEVER auto-confirms.
  2. **Related task** — dropdown of company's open tasks; pre-suggests the current
     task if user is in a task context; "Not related to a specific task" is an option.
  3. **What is this about?** — title (1 line, required) + optional 2-line description.
     System pre-suggests title from filename + context, again as an A11 mirror.
- Bottom: two actions side by side:
  - **Save as classified** (primary) — clears the gate, file becomes a team asset.
  - **Save as casual** (secondary) — skips classification, file is shared but does
    NOT count toward the asset pool. Disabled with explainer if user is at 3/3 today.
- Footer: "Casual today: 1 of 3" counter, always visible.

**View / download viewer:**
- Always shows the 3 classification fields above the file viewer or download CTA.
- Departmental color chip + task chip clickable to navigate.
- "Who's seen this" disclosure (A10) — collapsible list of viewer/downloader trail.
- Casual files have a distinct visual treatment ("Casual share — not classified")
  so the reader knows the asset value is intentionally not tracked.

**Library page (`/dashboard/files` — new route):**
- Three filters across the top: Department / Related task / Lane (classified/casual).
- Search by title + description.
- Sort: recently added, most-viewed, most-cited.
- Grid view (thumbnails for images, file-type icons for docs).
- Empty-state copy applies A8: not "no files yet" but "what asset would you upload
  first that another teammate would thank you for finding next month?"

---

## 5. The 7 decisions — my proposed defaults (B option)

The founder picked Option B (best-judgment defaults, red-pen). Here they are.

1. **Department source.** New `departments` table. Admin-managed (CEO/COO/admin can
   create). Defer "anyone creates" until the §4 readout suggests friction. v1 ships
   with five seeded department names per company at signup (Engineering, Customer
   Success, Operations, Growth, Leadership) — admin can rename/add/archive.

2. **File → task cardinality.** ONE primary task. Files often genuinely relate to
   multiple efforts; v1 ships one-to-one to keep the gate honest (forcing the
   uploader to pick the most-related task is a feature, not a limitation). v2 can
   add `also_related_tasks` if §4 shows the constraint is causing skipped
   classifications. Also: `task_id` is NULL-able — many C.A.R.E and chat files
   don't relate to a task, they relate to a conversation. See O2 below.

3. **"What is this about" shape.** Required **title** (1-line, ≤120 chars) + optional
   **description** (≤500 chars). Title is the gate field; description is the asset-
   compounding field. The title is what shows on the message bubble / library row;
   the description is what shows on the viewer.

4. **Storage backend.** Supabase Storage. Size cap: **25 MB** per file (covers
   95%+ of real docs, blocks bulk video). Allowed types: images (jpg/png/gif/webp),
   docs (pdf/docx/xlsx/csv/txt/md), audio (mp3/m4a — for C.A.R.E voice attachments
   later). **Block: executables, archives (zip/rar), >25MB.** Admins can request a
   raise via support if needed — out of scope to build that UI for v1.

5. **Permissions.** Any active company member sees all files (subject to RLS on
   `company_id`). **Department-level scoping is deferred** — it sounds like a feature
   but in practice forces the System to make a verdict (this user "should" see this
   department's files) which trips A11. v2 candidate. **C.A.R.E customer-uploaded files
   from the widget: OUT of scope for v1** — different security model (customers are
   not authenticated members), worth its own spec.

6. **Casual cap mechanics.**
   - **Per user, UTC day.** UTC for honesty and avoiding timezone-shopping; v2 can
     personalize.
   - **All three surfaces count** toward the same cap. The cap is about the user's
     total casual sharing across the team, not per-channel.
   - At cap, the **Save as casual** button is disabled with explainer copy in A8
     voice: "3 of 3 casual shares used today. This is the structural defense against
     drift — if this file is worth sharing, classifying it takes a few seconds and
     compounds." (Not "limit reached." A7-shaped.)

7. **Retrieval surface.**
   - Files live inline (on the task, in the chat thread, on the C.A.R.E conversation)
     so the WORKFLOW surface always has them.
   - PLUS a dedicated `/dashboard/files` library page with search + filter by all 3
     fields. Both. The inline surface is for the in-context user; the library is for
     the "I know we have a deck about X somewhere" user. The library is where the
     §4 readout instrumentation lives (re-retrieval rate is measured at the library
     visit).

---

## 6. Open uncertainties (A4 — deferred to the §4 readout, not pre-resolved)

These are the questions I deliberately did NOT pre-resolve. They become part of the
§4 readout deliverables.

- **O1. Is "title required" the right gate threshold?** Maybe "department + task" is
  enough and "title" should be optional. The §4 readout answers this by measuring
  whether files with rich titles ARE retrieved more than files with minimal titles.
  If yes, the gate is right; if no, weaken it.
- **O2. Should classification accept "linked to a conversation" as a third option
  alongside "task" and "no task"?** C.A.R.E and chat files often relate to a topic /
  conversation, not a task. v1 proposal: `task_id` is null-able and `linked_topic_id`
  is a separate optional column. The §4 readout tells us whether topic-linked files
  retrieve as well as task-linked ones.
- **O3. UTC day vs. user local day for the casual cap.** UTC is the v1 default for
  honesty. If users complain about the boundary (cap resets at unfortunate local
  times for some), v2 picks up local-day.
- **O4. AI classification suggestion model.** v1 uses the existing LLM provider
  (DeepSeek) with a structured prompt. Quality TBD. The `file_classification_
  suggestions` table tracks accepted/changed per A11+§3.5. If accuracy is low, the
  suggestion is suppressed for low-confidence cases; the user just sees empty
  fields. NEVER auto-classify.
- **O5. Department-level read scoping.** Deferred to v2. The v1 default is
  "company-wide visibility" because asset value compounds with wider access; the
  question is whether some files (HR, legal, M&A) need narrower scope. The §4
  readout signal is whether users complain about over-visibility OR whether they
  silently skip uploading sensitive files (the latter is detectable as a gap in
  what got uploaded vs. what we'd expect).
- **O6. `@file` autocomplete UX.** Should it be in the chat composer's `@`
  autocomplete (alongside `@people`), or a separate `/file` slash command, or both?
  v1 ships `@file` in the autocomplete (lowest friction). If it spams the autocomplete
  too much, v2 splits.
- **O7. File versioning.** OUT of scope for v1. Re-uploading a file with the same
  title creates a NEW row. The §4 readout tells us whether teams need versioning.
- **O8. Customer-uploaded files via C.A.R.E widget.** OUT of scope for v1. Different
  security model (unauthenticated visitor + classification opt-in), worth its own
  spec.
- **O9. Library page sort: should "most cited" be the default sort or "most recent"?**
  Asset value would suggest most-cited; recency is the workflow norm. v1 default:
  "Recently added" because the immediate UX is "I uploaded that — where is it?". The
  §4 readout tells us whether users actually navigate to "most cited" when given the
  choice.

---

## 7. Phased build path (incremental, walking-skeleton each phase)

Per A6 (ship none alone) — each phase moves all three pillars forward for one surface
at a time. NO phase ships classification-without-retrieval or retrieval-without-reuse.

**Phase 0 — Schema + storage foundation.**
- Migration 0055: `departments` table + seed.
- Migration 0056: `files` + `file_classification_suggestions` tables + RLS.
- Migration 0057: new `events` kinds (asset.file.*).
- Supabase Storage bucket created + RLS policies.
- No UI yet. Not user-visible.

**Phase 1 — Library page (`/dashboard/files`) — retrieval pillar standalone.**
- Empty state in A8 voice.
- Manual upload UI (the page IS the dropzone).
- Classification modal.
- Search + filter + sort.
- Viewer + download + "who's seen this" trail.
- Casual lane + 3/day counter.
- This phase is the retrieval pillar PLUS classification PLUS basic reuse (download
  trail). The library is the entire UX in this phase — no surface integration yet.
- Ship. Founder uses it for a few days. Red-pen.

**Phase 2 — Tasks integration.**
- Dropzone on task gate + task detail.
- Files render as an "Assets" tab on the task.
- Pre-fill: task → department + task field in classification modal.
- `@file` autocomplete added to task description / comments (if they exist).
- Citation events when a file is `@`-mentioned in task body.

**Phase 3 — Team Chat integration.**
- Dropzone in chat composer.
- File renders as a message in the thread (with the classification chip).
- Pre-fill: topic's task (if linked) → task field; topic → optional `linked_topic_id`.
- `@file` autocomplete in composer.
- Per A14 (data path vs. render path), test EVERY render branch: thread view,
  message search results, mobile vs. desktop, notification body, email digest.

**Phase 4 — C.A.R.E integration (agent side only — customer uploads is O8).**
- Dropzone in C.A.R.E reply composer.
- File renders to customer as a download link in the widget.
- Files attached to a C.A.R.E conversation get auto-suggested `linked_topic_id` =
  the conversation ID.

**Phase 5 — Cross-team `@person` share with classification.**
- `@person` in any composer can be paired with a file attachment.
- The recipient gets a notification with the classification chip.
- A `file.shared` event records the cross-surface flow.

**Phase 6 — §4 readout dashboard.**
- A new section in `/dashboard/brain` (or a new `/dashboard/assets-readout`):
  re-retrieval rate, cross-actor retrieval, citation rate, casual-share
  distribution. Per §3.5 these are downstream-consequence metrics, not adoption
  metrics.
- Per A10: every user has their own self-view of "files I uploaded; who looked at
  them; what classifications I changed vs. accepted from the System."
- Per A8: empty states framed as "the team is in month 1 — nothing to report yet."

---

## 8. What this spec is NOT (deliberate scope boundaries)

- NOT versioning files. Re-upload = new file row.
- NOT customer-uploaded files via C.A.R.E widget. Different security model.
- NOT "anyone can create a department." Admin-managed for v1.
- NOT department-scoped read permissions. Company-wide visibility for v1.
- NOT a full file-preview engine. Images preview inline; docs show a download CTA
  with file-type icon. PDF inline preview is a v2 candidate.
- NOT a quota system. Storage cost mgmt is an admin-level concern; per-user storage
  quotas are out of scope for v1.
- NOT signing / e-signature. Adjacent feature; separate spec when needed.

---

## 9. Ripple-trace (A5)

What other surfaces does adding files touch that I would otherwise miss?

- **Notifications** — `file.shared` and citations need to produce notifications.
  The `/api/notifications` route handler will need to read the new event kinds.
- **Search** — global search (if it exists) should index file titles + descriptions.
  Confirm: does global search exist? If yes, ripple-trace. If no, search is library
  local for v1.
- **Care chain (§3.1 chain events for support)** — file attachments inside C.A.R.E
  should produce chain events visible to the same `[care.*]` log infrastructure for
  audit consistency.
- **Mobile** — every dropzone needs a click-to-pick fallback because drag-and-drop
  doesn't apply on touch. Per the earlier safe-area work, the classification modal
  needs `pt-[max(..,env(safe-area-inset-top))]` on iOS.
- **Coach v6** — when a chat draft references a file, Coach should NOT treat the
  filename as a content-bearing token (e.g., "annual-budget.pdf" is not a
  bare-assertion candidate). Need a token-skip rule.
- **Brain page** — Top patterns and learnings panels will eventually surface
  "files-most-cited" as an asset signal. v1 doesn't build this but the schema
  supports it.

---

## 10. The verification checklist (A14)

Before declaring any phase shipped, walk every render branch:

- [ ] Inline view (the file on the task / chat / care conversation)
- [ ] Library row (small thumbnail + classification chips)
- [ ] Library detail view (full viewer)
- [ ] Mobile inline view
- [ ] Mobile library
- [ ] Mobile classification modal (safe-area + composer-not-occluded)
- [ ] Notification body when shared
- [ ] Search result row
- [ ] Empty state (library, task assets tab, chat-with-no-files)
- [ ] At-cap state for casual lane (button disabled + explainer)
- [ ] Failed-upload state (file too big, wrong type, network error)
- [ ] Deprecated file state ("uploader removed this file")
- [ ] A10 self-view ("files I uploaded + who has seen them")

---

## 11. Asks for the founder (red-pen prompts)

The following are the highest-leverage decisions I'd want explicit acknowledgment
on. Anything I got wrong in Section 5 + 6 is open for change.

1. **Frame check.** Does the §3.1-chain-applied-to-assets frame (Section 1) match
   your intent? If not, naming where it diverges is the most important red-pen.
2. **Triad acceptance.** Are you OK with the "ship none alone" rule (Section 3)?
   That dictates the phased build — no shortcuts to a Library-only or Tasks-only v1.
3. **The §4 readout (Section 2).** Are these the right metrics to bet the feature
   on? Anything missing? Anything that smells like "agreement instead of consequence"
   that I'd want named so I don't drift into it?
4. **The 7 decisions (Section 5).** Each is a default; red-pen the ones you'd
   change.
5. **Departments seed list.** I proposed Engineering / Customer Success / Operations
   / Growth / Leadership as the v1 seeds. Override?
6. **Cap mechanic (Section 5, #6).** Is 3 the right number? Per UTC day OK? The
   A7-shaped explainer copy when at cap — does it land?
7. **Out of scope (Section 8) — anything you DO want in v1 that I deferred?**

Once these land, I write the schema migrations and Phase 0 + Phase 1, then ship for
red-pen iteration.

---

*Closing the loop on this spec itself: when v1 ships and the §4 readout produces
real data, this doc becomes a §1.6 closure event. The deltas between what we
predicted and what we measured are themselves assets — they feed the next round.
That is the constitution at work, not on the product, but on the build of the
product.*
