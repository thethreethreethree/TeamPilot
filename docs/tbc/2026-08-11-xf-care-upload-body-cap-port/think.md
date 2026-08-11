---
tbc_version: 1
trigger: fix
started_at: 2026-08-11T16:10:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 16
hypotheses: 3
---

# THINK — Port the two C.A.R.E conversation uploads off the ~4.5 MB Vercel body cap (audit F2)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged. Build-system doc
`docs/THINK-BUILD-CHECK-PROMPTS.md` present.

## 2. The bug (confirmed by reading the two routes 2026-08-11)
Both C.A.R.E conversation upload routes receive the file **through the serverless function body**
(`await req.formData()`), which Vercel hard-caps at **~4.5 MB**, then upload to Storage server-side. Any
attachment between ~4.5 MB and the advertised cap fails at the *platform* layer, before the handler runs — the
same silent "Failed to fetch" the Sales-Coach recording upload had.

| Route | Advertised cap | Who hits it |
|---|---|---|
| `care/conversations/[id]/upload` | 10 MB (`CUSTOMER_MAX_BYTES`) | **customers** attaching a phone photo / scanned PDF in the chat widget |
| `care/conversations/[id]/agent-upload` | 25 MB (`AGENT_MAX_BYTES`) | **agents** attaching images / PDFs / docs to a support conversation |

A 5–10 MB phone photo is routine in a support conversation. **Class:** large-file upload routed through the
serverless function body instead of client→storage. This is the exact class the F2 finding (audit
`2026-08-11-recording-upload-artifact-audit.md`, A29 class-sweep) named, with the fix specified in
`docs/proposals/2026-08-11-care-upload-body-cap-port.md`. Founder greenlit the port 2026-08-11.

## 3. The fix — mirror the PROVEN signed-URL direct-to-storage pattern (A28, don't invent)
The codebase already ships this exact pattern in the Sales-Coach recording upload (sign endpoint +
JSON-finalize branch on the existing route + kept multipart fallback; client does
sign → `uploadToSignedUrl` → finalize). Reusable primitives: `createSignedUploadTarget`, `getAssetObjectInfo`,
`validateUploadCandidate`, `ASSETS_BUCKET`.

Per route: a new `…/sign` endpoint (auth + conversation gate + up-front size/type/ext validate →
`createSignedUploadTarget`), a JSON finalize branch on the existing route (companyId-prefix check on the
untrusted `storagePath` per audit F1 → `getAssetObjectInfo` → **re-validate the REAL stored object** →
attach), and the multipart branch KEPT as a small-file fallback so nothing regresses.

## 4. Correction to the proposal's premise (read the client, don't trust the plan)
The proposal assumed `FileDropzone` already did the signed flow for `/api/files`. Reading it: **it does not** —
its `upload()` always POSTs multipart. The customer path uses a bespoke `CustomerUploadButton` (clean
conversion). So the agent path needs `FileDropzone` to gain the signed flow. To avoid regressing its FOUR
other callers (library, tasks, chat, folder-zip), the change is an **opt-in `signEndpoint` prop**: omitted →
the existing multipart path is byte-for-byte unchanged; set → the signed flow. Only the C.A.R.E agent
composer passes it. This is the "generalize the mechanism, don't special-case" altitude choice.

## 5. Hypotheses (§1.5.2 think-first)
- **H1 — the finalize's admin read is a cross-company hole.** `getAssetObjectInfo` uses the admin client
  (RLS bypass) on caller-supplied `storagePath`. → Closed by construction: require
  `storagePath.startsWith(companyId + "/")` before the read (audit F1's lesson), mirrored on BOTH routes.
  Locked by a test on each route. CONFIRMED.
- **H2 — a browser could smuggle a disallowed/oversized file by lying at sign time.** The sign step validates
  the CLAIMED size/type. → The finalize re-runs `validateUploadCandidate` against the REAL stored size +
  content-type from `getAssetObjectInfo`; the browser can't lie about what actually landed. CONFIRMED (tested:
  real-type executable → 400, real-size > cap → 400).
- **H3 — the opt-in `signEndpoint` regresses the 4 other FileDropzone callers.** → The multipart branch is
  unchanged and taken whenever `signEndpoint` is undefined (all other callers). Existing dropzone tests +
  typecheck green. CONFIRMED additive.

## 6. Decision checklist (§6)
Understood (root cause read from the routes, not guessed); precedent reused (mirrors the shipped recording
upload); constraint real (Vercel platform cap) → better destination (client→storage), not a lock-pick;
holistic (both routes + the shared dropzone + both clients traced); guiding not overtaking (founder greenlit
the port + the sequencing). Layer-3 workflow continuity: the customer/agent still lands back in the
conversation with the attachment inline — same post-upload state as before, just no longer failing on a big
file.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T16:11:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — read WHY the uploads fail before porting them.", "how_this_build_will_embody_it": "Read both routes; the root cause (formData body cap) is read from the code, and the fix targets that, not a symptom." },
  { "id": "§0.1", "read_at": "2026-08-11T16:11:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition before a substantive build.", "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md hashes verified in-tree; build-system doc present." },
  { "id": "§1.5.1", "read_at": "2026-08-11T16:12:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer feature evaluation — structure, effectivity, composition, surface, in order.", "how_this_build_will_embody_it": "Kept the multipart fallback (structure), tested the finalize gates (effectivity), left the 4 other dropzone callers untouched (composition), same inline-attachment surface (surface)." },
  { "id": "§1.5.2", "read_at": "2026-08-11T16:12:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — THINK first about adjacent breakage, then search to confirm.", "how_this_build_will_embody_it": "Grepped every ASSETS-bucket formData() route; confirmed only these two + upload-recording (done) + /api/files (out of scope) exist." },
  { "id": "§3.4", "read_at": "2026-08-11T16:13:00Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — never return 200 as if an attachment posted when it did not.", "how_this_build_will_embody_it": "The agent finalize returns 502 honestly when postAgentMessage fails; the customer finalize surfaces a real error, never a silent drop." },
  { "id": "§6", "read_at": "2026-08-11T16:13:30Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The decision checklist forces understanding + ripple-tracing + holistic-vs-local before acting.", "how_this_build_will_embody_it": "Section 6 answers each item; it drove tracing the ripple to both clients + the shared dropzone before writing." },
  { "id": "A19", "read_at": "2026-08-11T16:11:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology must be consulted from the working tree this session.", "how_this_build_will_embody_it": "Re-read both routes + the recording-upload pattern in-tree before mirroring them." },
  { "id": "A22", "read_at": "2026-08-11T16:14:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads, not cached labels.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; the minimum set is present." },
  { "id": "A28", "read_at": "2026-08-11T16:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "Reuse the proven pattern already in the codebase rather than inventing a new one.", "how_this_build_will_embody_it": "The signed-URL flow is copied from the shipped Sales-Coach recording upload, not designed fresh." },
  { "id": "A29", "read_at": "2026-08-11T16:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "28-40", "why_it_governs": "A found bug is one instance of a class; sweep for the siblings.", "how_this_build_will_embody_it": "This build IS the class-sweep result of F2 — the two sibling upload routes the recording fix's sweep surfaced." },
  { "id": "A30", "read_at": "2026-08-11T16:16:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class in a test, or name the hole (A33) if the gate is infeasible.", "how_this_build_will_embody_it": "The cross-company + real-object gates are locked by a test on each route; the structural A30 lint is A33-declined with the hole named in the residual." },
  { "id": "A31", "read_at": "2026-08-11T16:16:30Z", "source_file": "ThinkerThinker.md", "line_range": "96-104", "why_it_governs": "The DB↔surface seam is where a 'done' feature silently becomes nonexistent — assert both paths.", "how_this_build_will_embody_it": "build.md names a write-path AND read-path for every feature." },
  { "id": "A33", "read_at": "2026-08-11T16:16:45Z", "source_file": "ThinkerThinker.md", "line_range": "28-40", "why_it_governs": "A gate that resists precise detection is named-and-declined, not shipped noisy.", "how_this_build_will_embody_it": "The A30 structural lint is declined (three heterogeneous cap mechanisms) with the hole named in check.md + residual R2." },
  { "id": "A35", "read_at": "2026-08-11T16:17:00Z", "source_file": "ThinkerThinker.md", "line_range": "28-40", "why_it_governs": "Name the un-named reliances a build silently depends on.", "how_this_build_will_embody_it": "closure.md lists four (direct storage reachability, getAssetObjectInfo truth, widget env, storagePath layout)." },
  { "id": "A36", "read_at": "2026-08-11T16:17:30Z", "source_file": "ThinkerThinker.md", "line_range": "28-40", "why_it_governs": "Read the residual from the TOP of the confidence-it-does-not-matter ranking.", "how_this_build_will_embody_it": "The top residual (other body-cap routes) is OPENED with an outcome — the sweep that confirmed no sibling remains." },
  { "id": "A38", "read_at": "2026-08-11T16:18:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' is a claim about a command — paste its output + exit code.", "how_this_build_will_embody_it": "check.md + closure.md paste the vitest / typecheck / npm run check runs with exit codes." }
]
```
