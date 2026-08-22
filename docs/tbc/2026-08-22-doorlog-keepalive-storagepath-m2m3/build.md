# BUILD — DoorLog residuals: keepalive + reject empty storagePath (audit M2 + M3)

### the fire-and-forget save survives the rep leaving (M2)
- write-path: `postDoorLog`'s `fetch(DOOR_LOG_URL, …)` now sets `keepalive: true`. The pitch/knock POST completes
  across a page unload (rep walks to the next door / PWA backgrounds), so the RECORD isn't abandoned. Bodies are
  tiny (audio already streamed as live chunks), well under the 64KB keepalive cap.
- read-path: the DoorLog UI still returns to idle immediately ("zero waiting") — unchanged — but the record now
  lands even after the component unmounts; a failure still surfaces the honest banner when the component survives.

### an empty storagePath can't mint a doomed pitch (M3)
- write-path: `PitchBody.storagePath` is now `z.string().min(1).max(400).optional()` — a present-but-empty path is
  rejected at the schema boundary (400), never reaching pitch creation. The chunked path sends `recordingId`
  (storagePath omitted), so no regression.
- read-path: a degraded client that sent `storagePath: ""` now receives a clean 400 (the schema/route rejects it)
  instead of the worker later surfacing a terminally-`failed` pitch card built from empty input; a normal client
  (recordingId or a real path) is unaffected.

## Files
- `src/components/sales-coach/doorlog/DoorLog.tsx` — `keepalive: true` on the door-log POST.
- `src/app/api/coach/sales-session/door-log/route.ts` — `storagePath` schema `.min(1)`.
- tests: `DoorLogChunkedSave.render.test.tsx` (+1: every door-log POST is keepalive; +1 assertion on the pitch
  POST) — captures `init.keepalive`.

## Ripple (§1.5)
No data/schema change. The single-blob fallback's storage upload (multi-MB) is NOT keepalive-eligible, but the
primary chunked path is already durable — noted as residual. M3 is defense-in-depth over the route's existing
branch-level 400.
