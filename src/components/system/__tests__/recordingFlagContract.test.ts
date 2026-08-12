import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DRIFT GUARD — the "never auto-reload during a live recording" contract.
 *
 * VersionWatcher's forced auto-update (2026-08-13) reloads a stale client on revisit, but MUST NOT do so while a
 * call is recording — interrupting it destroys the recording, the exact failure the capture fix exists to prevent.
 * The guard is a three-file contract carried by two plain strings:
 *   - the flag  `document.body.dataset.recording === "1"`
 *   - the event `elostate:recording-ended`
 * The SETTERS (LiveCoachingPanel, CARE useVoiceMode) write the flag + dispatch the event; the READER
 * (VersionWatcher) reads the flag + listens for the event. Nothing but a comment ties the three together, so a
 * rename in ONE file would silently break the guard and let a reload land mid-call. This test fails the build if
 * they ever drift out of agreement. (Verified consistent by hand 2026-08-13; this pins it.)
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(here, "..", "..", rel), "utf8");

const FLAG_WRITE = 'document.body.dataset.recording = "1"';
const FLAG_READ = 'document.body.dataset.recording === "1"';
const EVENT_DISPATCH = 'dispatchEvent(new Event("elostate:recording-ended"))';
const EVENT_LISTEN = '"elostate:recording-ended"';

const SETTERS = [
  "sales-coach/LiveCoachingPanel.tsx",
  "care/voice/useVoiceMode.ts",
];
const READER = "system/VersionWatcher.tsx";

describe("recording-flag contract (VersionWatcher forced-update guard)", () => {
  it.each(SETTERS)("%s writes the flag and dispatches the recording-ended event", (rel) => {
    const code = src(rel);
    expect(code, `${rel} must set document.body.dataset.recording = "1" while a call is live`).toContain(FLAG_WRITE);
    expect(code, `${rel} must dispatch elostate:recording-ended when the call ends`).toContain(EVENT_DISPATCH);
  });

  it("VersionWatcher reads the same flag and listens for the same event", () => {
    const code = src(READER);
    expect(code, "VersionWatcher must gate the reload on document.body.dataset.recording === \"1\"").toContain(
      FLAG_READ,
    );
    expect(code, "VersionWatcher must apply a held update when elostate:recording-ended fires").toContain(
      EVENT_LISTEN,
    );
  });
});
