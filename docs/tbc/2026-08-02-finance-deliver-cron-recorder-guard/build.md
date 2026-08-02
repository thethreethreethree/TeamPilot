# BUILD — finance deliver-cron recorder guard

## Doc integrity (§0.1) — command + output think.md section 1 refers to
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change
`src/app/api/finance/reports/deliver-cron/route.ts` — the per-item delivery loop.

- **success path:** `sent++` now happens immediately after a confirmed push; the `fin_record_report_delivery`
  `'sent'` write moved INSIDE the success branch and is wrapped in its own `try/catch` (logs, continues). A
  record-throw can no longer (a) fall through to the outer catch and reclassify a delivered report as failed,
  or (b) abort the batch.
- **failure path:** the `fin_record_report_delivery` `'failed'` write is wrapped in its own `try/catch` (logs,
  continues). A throw while recording a failure can no longer propagate out of the loop and drop every delivery
  scheduled after it.

No change to: auth (CRON_SECRET + constant-time compare), the due-list read, the return shape `{due, sent,
failed}`, or the `fin_record_report_delivery` rpc itself.

Files:
- `src/app/api/finance/reports/deliver-cron/route.ts`
