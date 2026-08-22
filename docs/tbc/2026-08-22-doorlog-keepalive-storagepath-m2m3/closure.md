# CLOSURE — DoorLog residuals: keepalive + reject empty storagePath (audit M2 + M3)

## What shipped
DoorLog's fire-and-forget save now uses `keepalive: true`, so the pitch/knock record completes even when the rep
walks to the next door or the PWA backgrounds mid-flight (M2). And `PitchBody.storagePath` now requires `min(1)`,
so a present-but-empty path can't mint a doomed pitch record (M3, defense-in-depth over the route's existing 400).
No data/schema change. Full `npm run check` exit 0.

This closes audit **M2 + M3**. **M1** was confirmed already mitigated — the DropReason distinguishes
`upload_failed` from `no_capture`, and the primary path streams live chunks so a failed final upload doesn't lose
the recording. With this, all HIGH (H1-H4) + the DoorLog MEDs are addressed; remaining audit items are M4 (meeting
Stop optimistic copy) and L1/L2 (LOW).

## The un-named reliance
- **keepalive is best-effort per the browser.** It raises the odds the request completes across unload; it is not
  a durable queue. The record's real durability still rests on the chunked audio already in storage + the
  server-side idempotent create + the per-minute cron.
- **The single-blob fallback upload is NOT keepalive** (multi-MB > 64KB cap). It's the fallback-of-fallback; the
  chunked path is primary and durable.

## Residual (A36)

```json
[
  {
    "id": "m2-single-blob-fallback-not-keepalive",
    "item": "The single-blob fallback storage upload (used only when NO chunk reached storage) is not keepalive-eligible (>64KB), so it can still be abandoned on unload.",
    "why_skipped": "Fallback-of-fallback: it runs only when live chunking failed entirely; the primary chunked path is durable, and the knock disposition still saves. A durable client-side blob queue (IndexedDB) is a larger, separate feature.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T16:40:00+08:00",
    "outcome": "Primary path durable; rare fallback loss accepted."
  },
  {
    "id": "remaining-audit-m4-l1-l2",
    "item": "M4 (meeting Stop unconditional 'saving now' copy) and L1/L2 (KPI read-error → 0; pitch duration wall-clock) remain.",
    "why_skipped": "M4 is the meeting bundle's MED; L1/L2 are LOW. Each ships as its own verified change.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T16:40:00+08:00",
    "outcome": "Tracked in docs/RELIABILITY-AUDIT-2026-08-22.md."
  }
]
```
