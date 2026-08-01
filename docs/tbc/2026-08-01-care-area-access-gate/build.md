# BUILD — C.A.R.E area access gate

## Doc integrity (§0.1) — command + output think.md section 1 refers to
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

### C.A.R.E layout access gate
`src/app/dashboard/care/layout.tsx` — converted the layout to an async server component that gates entry to
the C.A.R.E area, mirroring the sales-coach layout gate (A21).

- **write-path:** reads the caller's `profiles.role, is_support_agent`; if NOT (`is_support_agent` OR role in
  CEO/COO/admin) → `redirect("/dashboard")`. The predicate is exactly `requireCareAgent`'s
  (careAgentAuth.ts:29), so no legitimate care user is denied. Demo mode (no Supabase) bypasses.
- **read-path:** a legitimate care user (admin or support agent) renders `<CareShell>` as before; a non-care
  user is redirected to /dashboard server-side (no shell flash) instead of seeing a CareShell whose API calls
  all 403.

Files:
- `src/app/dashboard/care/layout.tsx`
