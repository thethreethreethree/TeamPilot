# BUILD — verify:live SECURITY DEFINER search_path guard

### definer search_path check

A new `verify:live` check in `scripts/verify-invariants-live.mjs`.

- **write-path:** queries the LIVE catalog for `public` SECURITY DEFINER functions whose `proconfig` has no
  `search_path=%` entry. If the count is non-zero → `pass:false` → verify:live exits non-zero, naming the
  offending functions — an elevated function that could resolve a caller-controlled malicious object.
- **read-path:** `npm run verify:live` prints `✓ PASS no SECURITY DEFINER function lacks a pinned
  search_path …` when healthy; a failure names the unpinned functions.

The LIVE, CI-integrated form of Supabase's own linter finding, so a new definer fn added without
`set search_path` fails the build (not just a manual dashboard warning).

Files:
- `scripts/verify-invariants-live.mjs` — the new check (now 22 invariants total).
