# REVISION MANIFEST — Settings Slice 3 (Timezone), consumption foundation

Founder decision (2026-07-29): "wire consumption FIRST, THEN add the per-user override." This slice
delivers the consumption foundation. Dogfoods `npm run tbc:revision`.

```json
[
  { "id": "TZ-F1", "verb": "ADD", "item": "Shared timezone-aware timestamp formatter (was: scattered ad-hoc formatting, zone ignored).", "disposition": "done", "evidence": "src/lib/datetime/format.ts formatInTimeZone + resolveTimeZone; test 8/8 incl. per-zone-difference + bad-zone degrade." },
  { "id": "TZ-F2", "verb": "CHANGE", "item": "Make the stored companies.timezone actually consumed by at least one real display.", "disposition": "done", "evidence": "Settings 'Last saved' now formatInTimeZone(updated_at, company.timezone) instead of a raw UTC slice; tsc exit 0." }
]
```

**Explicitly OUT of this slice (tracked in docs/BUILD-STATE.md S3, NOT dropped):** broad adoption across
the other ~12 timestamp displays, and the per-user `profiles.timezone` override column. Both are the next
increment — the founder's "consumption first" means the override waits until consumption is broader, so
it does not become dead surface. resolveTimeZone already exists + is tested for when the override lands.
