# BUILD — doc-upload audit remediation

Files: `src/lib/documents/extractText.ts` (F5 cap, F2 decode order), `src/app/api/coach/sales-session/
extract/route.ts` (F3 byte cap + message), `src/components/sales-coach/DocUploadButton.tsx` (F3 client
pre-check), `src/lib/documents/__tests__/extractText.test.ts` (F2 + F5 gates).

### F5 — align extraction cap to the field cap

- write-path: **exists** — `MAX_EXTRACTED_CHARS` 500k → 100k (extractText.ts), so extracted text never
  exceeds what the corpus/product save + editor accept. human_can_set: manager uploads any doc.
- read-path: **exists** — the extracted text fills the editor and the Save button is ENABLED (length ≤
  100k); `truncated` fires + a "trimmed to fit" toast when a doc is longer. human_can_see: **yes** — Save works.
- reachability: **BUILT** — gate: MAX_EXTRACTED_CHARS ≤ 100k + a 300k doc caps at 100k (13/13).

### F3 — cap the upload to the platform body limit

- write-path: **exists** — route `MAX_FILE_BYTES` 15MB → 4MB + a matching client pre-check in
  DocUploadButton. human_can_set: manager picks a file.
- read-path: **exists** — an oversized file gets an instant "too large (4 MB)" toast (client) or a
  friendly 413 (server) instead of an opaque platform rejection. human_can_see: **yes**.
- reachability: **BUILT** — the advertised cap now equals what the serverless function body can receive.

### F2 — stop entity double-decoding

- write-path: **exists** — decodeEntities replaces `&amp;` LAST. human_can_set: n/a (extraction internal).
- read-path: **exists** — `&amp;lt;` extracts as `&lt;` (correct literal), not `<`. human_can_see: the
  editor shows the document's real text.
- reachability: **BUILT** — gate: `&amp;lt;`→`&lt;` and NOT `<`.

## Verification (A38)

`npm run check` output + exit code in closure.md's verification record.
