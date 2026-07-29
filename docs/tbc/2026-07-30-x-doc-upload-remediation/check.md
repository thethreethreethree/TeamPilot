# CHECK — doc-upload audit (two passes, A21) + remediation verification

Audited the BUILT files on disk (not memory). Standard: A27, §1.5.1 layer 3, A26/A33, A31.

## Pass 1 — within-module

### F3 — function-body upload advertises a cap above the platform limit

file+line: src/app/api/coach/sales-session/extract/route.ts:35
clause: A27
evidence: `const MAX_FILE_BYTES = 15 * 1024 * 1024;` on a route that reads `await req.formData()` — Vercel
serverless bodies cap ~4.5 MB, so a 5–15 MB upload is rejected by the platform before this runs.
severity: MEDIUM
class: a surface promising a byte limit the write path (behind the platform body cap) cannot honor.
sweep: `grep -rn "formData()" src/app/api` + `grep -rn "MAX_.*BYTES\|MAX_FILE" src` — the 25MB storage cap
is exempt (signed-URL direct upload, not function body); the 2MB logo cap is under the platform limit;
this route is the only function-body upload advertising a cap above it.

### F2 — entity double-decode

file+line: src/lib/documents/extractText.ts:128 (pre-fix order)
clause: A26 (correctness class)
evidence: `.replace(/&amp;/gi, "&")` ran BEFORE `.replace(/&lt;/gi, "<")`, so `&amp;lt;` → `&lt;` → `<`.
severity: LOW
class: sequential string replacement where an earlier replacement's output is re-matched by a later one.
sweep: `grep -rln "&amp;" src/lib src/app` — the other matches are literal JSX text ("Product &amp; brand");
extractText.decodeEntities is the sole decode-logic instance.

## Pass 2 — cross-module

### F5 — extraction cap exceeds the editor/save field cap

file+line: src/lib/documents/extractText.ts:52 ↔ src/app/api/coach/sales-session/corpus/route.ts:46
clause: §1.5.1 layer 3 (workflow continuity)
evidence: extraction `MAX_EXTRACTED_CHARS = 500_000` while the corpus/product save is `content:
z.string()...max(100000)` and the editor does `disabled={... || text.length > 100000}` — a 150k-char
upload fills the editor, then Save is disabled with no clear cause.
severity: MEDIUM
class: two ends of one seam enforcing different caps, so the upstream can produce what the downstream rejects.
sweep: `grep -rn "max(100000)\|> 100000\|100,000" src/app/api/coach src/app/dashboard/sales-coach` — the
methodology + product editors + both save routes all cap at 100k; extraction was the lone 500k.

### F1 — archive entry decompressed before the cap (zip-bomb)

file+line: src/lib/documents/extractText.ts:196, 209
clause: A27 (resource-exhaustion fragility)
evidence: `file.async("string")` fully decompresses one entry into memory before the `slice(0, MAX)` at
line 117; a high-ratio entry OOMs first.
severity: MEDIUM-class / LOW-practical (manager-gated, self-tenant, platform memory + maxDuration bound it).
class: unbounded decompression of an untrusted archive entry before the output cap.
sweep: `grep -rn "loadAsync\|\.async(" src --include=*.ts` — extractText is the ONLY server-side
archive-decompress site.

### F4 — binary-as-text garbage

file+line: src/lib/documents/extractText.ts:124
clause: A33 (no precise detector)
evidence: `new TextDecoder("utf-8", { fatal: false })` decodes a renamed binary to replacement chars.
severity: LOW
class: lenient decoding accepts non-text as text.
sweep: n/a — inherent to accepting a .txt; the manager reviews the draft before Save.

## Empty-findings interrogation (an empty flag list is itself suspicious)

Looked for and did NOT find: an auth bypass (route is manager-gated + tested 5/5), cross-tenant read
(no tenant data in extraction — it's the caller's own file), stored XSS (text never rendered as HTML; it
enters a textarea + prompt as data), a NEW prompt-injection boundary (the content enters the SAME prompts
client-authored methodology already enters). Their absence is structural (no-storage + extension-allowlist
+ manager-gate), not unexamined — so no CRITICAL/HIGH is honest, not a gap.

## Remediation verification

F5/F3/F2 FIXED (build.md); F1/F4 DECLINED (remediate.md). Full `npm run check` output in closure.md.
