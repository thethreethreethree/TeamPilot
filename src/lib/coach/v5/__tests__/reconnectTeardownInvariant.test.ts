import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * REGRESSION GUARD for the 2026-08-21 capture crisis (docs/CAPTURE-CRISIS-AUDIT-2026-08-21.md).
 *
 * The bug: the WS auto-reconnect called teardownMedia(), which stops the MediaRecorder + mic tracks — so
 * every mid-call drop stopped the recording and discarded the captured audio (behind ~93% of calls saving no
 * audio). The fix separated teardownForReconnect() (frees ONLY the socket + audio graph, KEEPS the recorder +
 * mic running) from teardownMedia() (full teardown on unmount/cancel).
 *
 * This invariant is not unit-testable through the hook (the teardown fns are closures over refs), so guard it
 * at the SOURCE (this repo's drift-guard idiom): teardownForReconnect must NOT touch the recorder or the mic
 * stream; teardownMedia MUST; and the reconnect scheduler must call teardownForReconnect, never teardownMedia.
 * If a future edit re-couples them, this fails instead of silently re-regressing capture.
 */

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), "../useLiveCoaching.ts");
const src = readFileSync(HOOK, "utf8");

/** Extract a `const <name> = useCallback(() => { … }, [...]);` body by brace-matching. */
function callbackBody(name: string): string {
  const anchor = `const ${name} = useCallback(() => {`;
  const start = src.indexOf(anchor);
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  let i = start + anchor.length;
  let depth = 1; // we're already inside the opening {
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return src.slice(start, i);
}

describe("reconnect teardown invariant (capture-crisis regression guard)", () => {
  const reconnectBody = callbackBody("teardownForReconnect");
  const fullBody = callbackBody("teardownMedia");

  it("teardownForReconnect does NOT stop the recorder or the mic (recording must survive a reconnect)", () => {
    expect(reconnectBody).not.toContain("recorderRef"); // must not touch/stop the MediaRecorder
    expect(reconnectBody).not.toContain("streamRef"); // must not stop the mic tracks
    // It SHOULD still free the socket + audio graph so the reconnect can rebuild them.
    expect(reconnectBody).toContain("wsRef");
    expect(reconnectBody).toContain("ctxRef");
  });

  it("teardownMedia (full teardown) DOES stop the recorder and the mic (unmount/cancel must free everything)", () => {
    expect(fullBody).toContain("recorderRef");
    expect(fullBody).toContain("streamRef");
  });

  it("the reconnect scheduler tears down for reconnect, never the full teardown", () => {
    // The scheduleReconnect closure (inside start()) must call teardownForReconnect — calling teardownMedia
    // there is the exact regression this guards.
    const schedStart = src.indexOf("const scheduleReconnect");
    expect(schedStart).toBeGreaterThanOrEqual(0);
    const schedRegion = src.slice(schedStart, schedStart + 800);
    expect(schedRegion).toContain("teardownForReconnect()");
    expect(schedRegion).not.toContain("teardownMedia()");
  });
});
