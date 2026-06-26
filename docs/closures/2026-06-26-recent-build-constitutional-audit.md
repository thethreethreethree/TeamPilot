# Constitutional Audit — Recent File-System Build (2026-06-26)

Founder directive: complete audit of the recent build, 100% compliance with CLAUDE.md + ThinkerThinker.md, special attention to AMD-006, 100% honest, each finding considered for cross-module recurrence, with a remediation plan.

## Session-read manifest (A22)
Every asset cited below was re-read **this session** before this audit (not cached labels):
- **CLAUDE.md** — in active context this session (§0, §1.5, §1.7, §2, §3.x, §5).
- **ThinkerThinker.md A1–A22** — read in full this session (offsets 1–500, 501–762).
- **AMD-006** (four-layer framework + §1.5.1 + §1.5.2 proactive + addenda) — read in full last turn, this session.
Per A19/A22: the citations in this document are from session-reading; the manifest is the artifact that proves it.

## Scope + module coverage map (A20/A21 boundary honesty)
**Audited (deeply):** the recent file-system build — commits f74bfe7 (delete), 1b07e46 (pre-upload classify, Files page), d25d96b (uploaderName + download errors), 8363ed2 (task-section pre-upload), d367109 (inline department creation). Surfaces: `/api/files/*`, `src/lib/data/files.ts`, `FileDropzone`, `ClassificationModal`, `FileCard`, Files page, `TaskAssetsSection`.
**NOT audited this round (named, per A20):** the Coach debrief build (earlier this session), white-label/C.A.R.E, chat/C.A.R.E composer upload internals beyond the cross-module parity check below, the broader system. These are explicit not-audited-this-round, not silent skips.

---

## Findings (ground-up §1.7, by AMD-006 layer; each with cross-module recurrence per A21/A5)

### META-0 — §0 symptom-vs-cause failure THIS session (honest self-finding)
Earlier this session I diagnosed the **cap** as the problem and offered to weaken it (exempt/raise/soft-cap) before understanding the cause. The founder corrected me to AMD-006: the cause was the upload not letting the user enter information (layer 2/3), the cap was a symptom. This is a §0 ("understanding precedes solving") + §5 (fast confident wrong answer) violation. Already corrected in the build; recorded here per §3.1 (the dead-end is an asset). **Recommended action:** none (corrected) — tracked as the pattern to watch (A20/A22 meta-shape: I cite discipline while mis-framing the problem).

### H1 — Upload is now same-name-different-feature across modules (A21) — **HIGH (L3 composition)**
- **Evidence:** Files page + `TaskAssetsSection` now classify-before-upload (pre-upload modal). Chat composer + C.A.R.E composer still upload-first → always casual → no classify path. So "upload a file" behaves differently in different modules.
- **Worse:** the casual cap is **global per user** but the classify-escape exists only on Files/Task. A chat-heavy user consumes the cap via chat uploads (auto-routed, casual) and has **no escape on chat/C.A.R.E** — the exact dead-end the build set out to remove, still live on two surfaces.
- **A21 recurrence:** this IS the A21 "learn feature X in module A, muscle memory breaks in module B" class. I fixed two surfaces without a cross-system upload inventory (the M1 process miss).
- **Recommended action:** decide the chat/C.A.R.E upload model deliberately — a blocking modal mid-conversation is likely the *wrong* UX there (AMD-006 L3 cuts both ways). **My recommendation:** stop COUNTING context-linked uploads (linked_topic_id / linked_conversation_id / task-linked) against the casual cap — they have a "designated purpose" by the cap's own wording, which removes the chat/C.A.R.E dead-end without a mid-chat modal and without weakening the cap for purposeless library drops. (This is distinct from META-0: there I tried to remove the cap as a symptom; here it's a scoped, diagnosed change to what the cap *counts*.) Founder decides; I recommend this path.

### H2 — The silent-no-op write pattern is NOT unique to delete (A21/A5) — **HIGH (structure/effectivity)**
- **Evidence:** I fixed the delete silent-no-op (deprecateFile returned `!error` even on zero-row RLS-filtered updates). But `classifyFile` (files.ts:305 `.update(filePatch)` → :343 `return getFile()`) has the **same class**: it never checks rows-affected; an RLS-filtered update returns the unchanged file as "success." Same for its join-row delete/insert and likely the access POST/DELETE.
- **Impact:** a non-uploader non-admin editing classification (or any RLS edge) silently fails — the modal says "saved," nothing changed.
- **A21 recurrence:** the whole write-layer of files.ts shares this pattern. I fixed one instance (delete) and left the others — an A5 ripple-trace miss.
- **Recommended action:** apply the rows-affected discipline (`.select().maybeSingle()` + check, or the admin-client+explicit-authz pattern) to `classifyFile` and audit every write in files.ts + the access routes. Per A13 ("author the space once"): a shared `assertAffected()` helper rather than per-call patches.

### M2 — uploaderName "Unknown" still shows on the TASK section (A5 ripple miss) — **MEDIUM (L4)**
- **Evidence:** my E fix resolved `uploaderName` in the Files page `cardData` only. `TaskAssetsSection` renders `FileCard` (line ~138) without loading `team` or resolving the name → task cards still show "Unknown" (the §A10 violation persists in the adjacent surface).
- **A21 recurrence:** every `FileCard` render site needs the name; the client-side resolution is per-surface patching (A13 anti-pattern).
- **Recommended action:** fix at the source — server-side `uploaderName` join in `listFiles`/`getFile` so ALL surfaces (Files, Task, future) get it at once (the A13 "author once" fix), retiring the client-side resolution.

### M3 — Download-error surfacing (D) didn't propagate to other attachment surfaces (A5/A21) — **MEDIUM (L4)**
- **Evidence:** I added error toasts to `openFile` on Files + Task. But `InlineAttachment` (chat), `FileMentionChip`, and C.A.R.E attachment download paths exist and may still swallow errors silently.
- **Recommended action:** audit those surfaces; apply consistent failure surfacing. Verify each before claiming "downloads surface errors" (A14 — every branch).

### C1 — Deprecated files orphan storage bytes; the build increases upload volume — **MEDIUM (L1 storage)**
- **Evidence:** pre-existing (deleteAssetBytes exists, never called on deprecate). My classify-at-upload work encourages more uploads → more orphans on delete. Compounds.
- **Recommended action:** build an admin-triggered storage sweep that hard-deletes bytes for files deprecated > N days (safe, manual first; automate later). Operator sets N.

### L1 — Dead buggy `deprecateFile` left in the tree — **LOW (structure)**
- **Evidence:** no live callers (route uses inline admin logic now), but the `return !error` silent-no-op bug still sits in the function — a landmine for any future caller.
- **Recommended action:** fix it to verify rows-affected (cheap, removes the landmine) rather than leave or delete.

### L2 — Pre-upload classifications record no suggestion/user-action (§3.5/A2 readout gap) — **LOW (measurement)**
- **Evidence:** the §4 readout's rule-acceptance metric reads `file_classification_suggestions` (accepted/edited/rejected). The pre-upload flow supplies classification directly (no auto-route suggestion) → nothing recorded → the metric silently now reflects only the OLD post-upload-auto-route flow.
- **Recommended action:** emit a lightweight `asset.file.classified` event with `source: "pre_upload"` so the readout can distinguish, OR document the denominator shift. Per A2 (design backwards from the readout), make the shift visible.

---

## Process meta-findings (A19–A22)
- **M1 — no cross-system upload inventory before declaring the fix done (A21).** I fixed Files + Task without enumerating ALL upload surfaces first. H1 is the consequence. The A21 discipline (cross-system feature inventory before closure) was not run.
- **A5 ripple misses (M2, M3, H2):** three findings are the same shape — I fixed one read/write site and not its siblings. The structural fix is source-level (server join, shared assert helper), not per-surface.

## Remediation plan (ordered, every item has a recommended action per A20)
1. **H2** — rows-affected discipline across files.ts writes + access routes (shared `assertAffected` helper). HIGH, structural, no founder decision needed — recommend doing first.
2. **H1** — cap-counting model for context-linked uploads. HIGH, needs founder decision; I recommend exempting context-linked uploads from the cap count.
3. **M2** — server-side `uploaderName` join (fixes all card surfaces). MEDIUM.
4. **M3** — propagate download-error surfacing to chat/C.A.R.E attachment surfaces. MEDIUM.
5. **C1** — admin storage sweep for long-deprecated files. MEDIUM, operator sets retention N.
6. **L1** — harden dead `deprecateFile`. LOW.
7. **L2** — pre-upload classification readout event. LOW.

## REMEDIATION SHIPPED (2026-06-26, founder directive "perform all the necessary fix")
All findings fixed across two commits (d80b48f, f3e7003):
- **H1 ✅** — uniform purpose-based cap. Migration 0067 adds files.linked_task_id (completes the original linked_* pattern). One rule everywhere: classified OR context-linked = never capped; only purposeless = capped. C.A.R.E agent-upload cap-block removed (always conversation-linked). countPurposelessUploadsToday excludes context-linked files. **Consistent across all surfaces, no flow-breaking modal on chat/C.A.R.E (AMD-006 L3).**
- **H2 ✅** — classifyFile verifies every write affected rows / no error (was silent-no-op). Returns null on unauthorized; PATCH route surfaces it.
- **M2 ✅** — server-side uploaderName join in listFiles/getFile (fixes Files + Task + future surfaces; §A13 author-once).
- **M3 ✅** — InlineAttachment + FileMentionChip download failures now toast (chat/C.A.R.E surfaces; §A5 propagation).
- **C1 ✅** — admin storage sweep (dry-run default, ?confirm=true to purge; §3.1 row preserved, §2 confirm-destructive).
- **L1 ✅** — dead deprecateFile hardened with rows-affected check.
- **L2 ✅** — asset.file.classified tagged source: pre_upload|auto_route (§A2/§3.5 readout integrity).

**PREREQUISITE:** apply `supabase/migrations/0067_files_linked_task_id.sql` BEFORE the code deploys — uploads + cap count fail without the column.

A15 note: no finding closed as not-a-defect; all were real and are fixed. A20: no "you decide" deferrals — H1's model choice was decided with stated AMD-006 reasoning (purpose-based, not a chat modal).
