import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadRun, saveRun, clearRun } from "../persistence";
import type { DiagnosisRun } from "../types";

/**
 * Local (localStorage) persistence for an in-progress diagnosis run. Pure + node-testable
 * once we stand up a minimal window.localStorage. The behaviours worth locking are the
 * DEFENSIVE ones: loadRun must survive a corrupted entry (a bad JSON blob left by an old
 * version or a truncated write) by returning null instead of throwing — otherwise the
 * diagnose page white-screens on load — and every function must be a safe no-op under SSR
 * (no window). The happy-path round-trip is pinned too so a serialization change is caught.
 */
const KEY = "execos.diagnosis.run.v1"; // must match persistence.ts

function installWindow() {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}
function removeWindow() {
  delete (globalThis as { window?: unknown }).window;
}

const RUN = { id: "d1", label: "test run" } as unknown as DiagnosisRun;

describe("diagnosis run persistence (localStorage draft)", () => {
  beforeEach(() => installWindow());
  afterEach(() => removeWindow());

  it("round-trips a run through save -> load (with a savedAt stamp)", () => {
    saveRun(RUN);
    const loaded = loadRun();
    expect(loaded?.run).toEqual(RUN);
    expect(typeof loaded?.savedAt).toBe("string");
  });

  it("loadRun returns null when nothing is stored", () => {
    expect(loadRun()).toBeNull();
  });

  it("clearRun removes the persisted run", () => {
    saveRun(RUN);
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it("loadRun survives a CORRUPTED entry — returns null, never throws (no white-screen)", () => {
    (globalThis as { window: { localStorage: Storage } }).window.localStorage.setItem(
      KEY,
      "{not valid json"
    );
    expect(() => loadRun()).not.toThrow();
    expect(loadRun()).toBeNull();
  });

  it("is a safe no-op / null under SSR (no window)", () => {
    removeWindow();
    expect(loadRun()).toBeNull();
    expect(() => saveRun(RUN)).not.toThrow();
    expect(() => clearRun()).not.toThrow();
  });
});
