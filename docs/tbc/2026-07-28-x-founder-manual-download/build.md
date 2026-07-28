# BUILD — founder-only manual download

Files: `src/app/founder/files/buildmanual/route.ts` (gated download), `.../manual-data.ts`
(embedded PDF), `src/app/founder/files/page.tsx` (gated Files page).

### Founder-only download route (`/founder/files/buildmanual`)

- write-path: **exists** — the founder hits the URL (via the Files page link or directly); the
  GET handler runs `requireVendorAdmin()` and, on pass, returns the PDF. human_can_set: **yes**
  (the founder triggers the download).
- read-path: **exists** — the response carries `Content-Type: application/pdf` +
  `Content-Disposition: attachment`, so the browser downloads the exact bytes
  (`manual-data.ts`, base64 → Buffer). human_can_see: **yes** — the file lands on disk.
- gate: `requireVendorAdmin()` — non-vendor-admins get an identical 401/403; the PDF is never
  returned to a customer or the public. `Cache-Control: private, no-store` keeps it out of caches.
- reachability: **BUILT** — base64 round-trips to 374419 bytes with a `%PDF` header (confirmed);
  typecheck exit 0.

### Founder-only Files page (`/founder/files`)

- write-path: **exists (discovery)** — the founder navigates to `/founder/files`; the page
  renders only after `isVendorAdmin()` passes. human_can_set: n/a (read-only surface).
- read-path: **exists** — for the founder, the page shows the manual + a Download button linking
  to the route. For anyone else, `notFound()` → 404 (the page does not exist for them).
  human_can_see: **yes** (founder) / **no + no signal** (everyone else).
- reachability: **BUILT** — the link target is the route above; both share the vendor-admin gate.

## Not in this build (flagged)

- The PDF is embedded as base64 (~488 KB in the route bundle). A follow-up could move it to a
  private storage bucket + signed URL to shed the bundle weight — recorded as residual.

## Verification (A38)

`npm run check` output + exit code pasted in closure.md's verification record.
