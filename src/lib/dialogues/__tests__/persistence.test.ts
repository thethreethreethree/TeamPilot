import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Local (localStorage) persistence for in-progress Decision Dialogue drafts. Modest but real: the round-trip
 * must survive, a corrupt value must degrade to null (not crash the page), and SSR (no window) must be a safe
 * no-op. Untested until now.
 */

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    _map: m,
  };
}

const { loadDialogue, saveDialogue, clearDialogue } = await import("../persistence");

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: fakeStorage() });
});
afterEach(() => vi.unstubAllGlobals());

describe("dialogue local persistence", () => {
  it("round-trips the saved state", () => {
    saveDialogue("decision", { situation: "pricing", step: 2 });
    expect(loadDialogue("decision")).toMatchObject({ state: { situation: "pricing", step: 2 } });
  });

  it("stamps savedAt on save", () => {
    saveDialogue("decision", { x: 1 });
    expect(typeof loadDialogue<{ x: number }>("decision")?.savedAt).toBe("string");
  });

  it("returns null when nothing is stored", () => {
    expect(loadDialogue("decision")).toBeNull();
  });

  it("degrades to null on a corrupt value (never crashes the page)", () => {
    (window.localStorage as unknown as { setItem: (k: string, v: string) => void }).setItem(
      "execos.dialogue.v1.decision",
      "{not valid json"
    );
    expect(loadDialogue("decision")).toBeNull();
  });

  it("clearDialogue removes the draft", () => {
    saveDialogue("decision", { x: 1 });
    clearDialogue("decision");
    expect(loadDialogue("decision")).toBeNull();
  });

  it("is a safe no-op under SSR (no window)", () => {
    vi.stubGlobal("window", undefined);
    expect(loadDialogue("decision")).toBeNull();
    expect(() => saveDialogue("decision", { x: 1 })).not.toThrow();
    expect(() => clearDialogue("decision")).not.toThrow();
  });

  it("save fails silently when storage throws (quota/disabled)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new Error("QuotaExceeded");
        },
        getItem: () => null,
        removeItem: () => {},
      },
    });
    expect(() => saveDialogue("decision", { x: 1 })).not.toThrow();
  });
});
