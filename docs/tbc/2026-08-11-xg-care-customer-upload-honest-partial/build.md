# BUILD — Customer upload honest-partial (502 on failed attachment post)

### Customer attach-tail returns 502 on a failed message post (`upload/route.ts` `attachCustomerFile`)
- write-path: after `createFileRecord`, capture `const posted = await postCustomerMessage(...)`. On `posted ===
  null`, return `502 { error, file: row }` BEFORE `emitAssetEvent` — the file row persists (recoverable),
  matching the agent tail's ordering. On success, unchanged: `emitAssetEvent` then `200 { file: row }`.
- read-path: the customer widget's existing `if (!res.ok)` branch reads `data?.error` and shows the retry
  message; it does NOT call `onUploaded()` on error, so no false thread refresh. On 200 the widget refreshes
  the thread exactly as before. Locked by the new 502-on-null test + the unchanged happy-path test.
