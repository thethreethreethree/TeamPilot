/**
 * Testing Library's wait budget for every render test (2026-11-26).
 *
 * Its default is 1000 ms: findBy… and waitFor give up after one second. Measured on a quiet machine that is plenty; in
 * the full gate (~970 files in flight) a render that takes 1.0x s fails — PitchPerformance's "Blue door" (2026-11-26) and
 * RecordingsTab (2026-09-22, which raised its own to 4 s) both passed alone and failed in the gate. A budget that only
 * holds when the suite is quiet is a flake generator. 5 s stays far under the 20 s test timeout (vitest.config.ts), so
 * a render that never comes still fails, as a timeout, rather than being retried until it passes.
 *
 * Only for files that opt into a DOM (`// @vitest-environment jsdom`); the node-only suite doesn't load Testing Library.
 */
if (typeof document !== "undefined") {
  const { configure } = await import("@testing-library/dom");
  configure({ asyncUtilTimeout: 5000 });
}
