---
tbc_version: 1
trigger: fix
started_at: 2026-08-02T00:58:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — departments rename must enforce the same length rule as create

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md). Both present and
read this session.

## 2. Why (§2 diagnose, §3.4 a rule enforced in one place only is a false guarantee)
Auditing input validation across the 15 body-parsing routes that lack a zod schema, the departments route
validates manually — well — except for one asymmetry: POST create caps the name at `1-80` chars, but PATCH
rename checked only non-empty. The `departments.name` column is `text` with NO DB length cap (0055:29), and
`renameDepartment` doesn't cap either — so the create-time rule was the ONLY guard, and it was absent on
rename. An admin could rename a department to an arbitrarily long name that create would reject. That's a
false-consistency: the product enforces a constraint it doesn't actually enforce everywhere (§3.4 — a
guarantee that holds on one path and not another is not a guarantee).

Root cause (§2): two code paths independently validate the same field and drifted; the rename path was written
with only the presence check.

## 3. Class sweep (§1.5.2, A26)
Swept the 15 no-zod body-parsing routes. The core write routes audited (resolutions PATCH, departments) are
otherwise thoroughly hand-validated (resolutions has write-once + race + strictUpdate guards; departments has
rate-limit + admin gate + JSON guard). The create/update length asymmetry in departments was the one real
gap found — the rest of the surface is well-hardened (a positive audit result, not an empty-because-unchecked
one). Class boundary = this one path.

## 4. Hypothesis
- **H1:** a rename with a >80-char name now returns 400 "Name must be 1-80 chars" (parity with create); a
  valid rename still succeeds; typecheck clean.

## 5. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T00:58:00Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand before fixing — I read both paths + the column definition to confirm the rule was genuinely missing, not enforced elsewhere.", "how_this_build_will_embody_it": "Section 2 grounds the gap in the create path, the rename path, and the schema." },
  { "id": "§0.1", "read_at": "2026-08-02T00:58:00Z", "source_file": "CLAUDE.md", "line_range": "26-40", "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH." },
  { "id": "§2", "read_at": "2026-08-02T00:58:00Z", "source_file": "CLAUDE.md", "line_range": "150-170", "why_it_governs": "Diagnose before patching.", "how_this_build_will_embody_it": "Section 2 names the drift between two validators as the root cause." },
  { "id": "§3.4", "read_at": "2026-08-02T00:58:00Z", "source_file": "CLAUDE.md", "line_range": "280-292", "why_it_governs": "Honesty — a constraint enforced on one path only is a false guarantee.", "how_this_build_will_embody_it": "The fix makes the rule hold on both paths." },
  { "id": "§1.5.2", "read_at": "2026-08-02T00:58:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — I audited the whole no-zod route set, not just this one file.", "how_this_build_will_embody_it": "Section 3 records the sweep + the positive result on the rest." },
  { "id": "§6", "read_at": "2026-08-02T00:58:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist.", "how_this_build_will_embody_it": "Diagnosed, swept, verified against the schema." },
  { "id": "A19", "read_at": "2026-08-02T00:58:00Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology in the tree.", "how_this_build_will_embody_it": "Confirmed present." },
  { "id": "A22", "read_at": "2026-08-02T00:58:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + trailer." },
  { "id": "A26", "read_at": "2026-08-02T00:58:00Z", "source_file": "ThinkerThinker.md", "line_range": "67", "why_it_governs": "A found bug is a CLASS — sweep it.", "how_this_build_will_embody_it": "Section 3 swept the no-zod route set; boundary = this path." },
  { "id": "A30", "read_at": "2026-08-02T00:58:00Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "An inline comment states the create-parity requirement + why the column has no cap." },
  { "id": "A38", "read_at": "2026-08-02T00:58:00Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck output." }
]
```
