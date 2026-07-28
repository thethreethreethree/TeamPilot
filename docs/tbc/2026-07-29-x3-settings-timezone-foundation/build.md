# BUILD — Settings Slice 3: Timezone consumption foundation

Files: `src/lib/datetime/format.ts` (new), `src/lib/datetime/__tests__/format.test.ts` (new),
`src/app/dashboard/settings/page.tsx` (wire the first consumer).

### Shared timezone-aware formatter

- write-path: **exists** — `formatInTimeZone(value, timeZone, style)` formats an instant in an IANA zone
  via `Intl.DateTimeFormat`; `resolveTimeZone(userTz, companyTz)` picks the effective zone (user→company→
  browser). human_can_set: n/a (a pure primitive callers use).
- read-path: **exists** — the Settings "Last saved" stamp now calls
  `formatInTimeZone(company.updated_at, company.timezone)`, so the stored company zone is rendered.
  human_can_see: **yes** — the stamp reads in the company's zone, not a raw UTC slice.
- reachability: **BUILT** — tsc exit 0; format test 8/8 (per-zone difference + bad-zone degrade + styles +
  resolve precedence).

### First consumer (Settings "Last saved")

- write-path: **exists** — the display was `updated_at.slice(0,19).replace("T"," ")` (UTC, zone-blind);
  now `formatInTimeZone(updated_at, company.timezone)`. human_can_set: n/a.
- read-path: **exists** — visible on the Settings page. human_can_see: **yes**.
- reachability: **BUILT** — the import + call compile (tsc exit 0); the timezone comes from the existing
  `/api/settings` payload (`settings.company.timezone`), already loaded on the page.

## Verification (A38)

`npm run check` output + exit code in closure.md's verification record.
