# BUILD — vendor-CRM shell gate (/dashboard/admin/crm)

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### AdminCrmLayout server gate
`src/app/dashboard/admin/crm/layout.tsx` (new) — a server component wrapping the two existing client CRM pages
(`crm/page.tsx`, `crm/[id]/page.tsx`).

- **write-path:** the gate's effect — on a non-vendor caller it calls `notFound()` (404), server-side, before
  any child renders; on a vendor admin it returns `<>{children}</>` unchanged. This is the ONLY behavior added;
  no data is written, no route/API touched. It mirrors `/founder/files`'s `notFound()` posture (don't reveal the
  area exists to non-vendors).
- **read-path:** reads the caller's context via `getCurrentAuthContext()` and evaluates
  `isVendorAdmin(ctx, getVendorCompanyId())` — the IDENTICAL predicate `requireVendorAdmin` uses on every CRM
  API route, so the layout decision and the data decision can never diverge (a vendor who passes the API passes
  the layout). `getVendorCompanyId()` resolves the vendor company the same way the C.A.R.E tenant layer does.

## Files
- `src/app/dashboard/admin/crm/layout.tsx` (new)
