import { describe, it, expect } from "vitest";
import { removeRecordingAudio, removeSessionChunks, type RecordingStorage } from "../removeRecordingAudio";
import { ASSETS_BUCKET } from "@/lib/storage/assets";

/**
 * The deletion path, and the one thing about it that is not a matter of taste.
 *
 * `storage.remove()` on a path that does not exist returns NO error. So the failure this whole module is shaped
 * around is silent by construction: guess the pointer's shape wrongly, remove nothing, clear the column, and the
 * recording of a real customer conversation survives forever while the run reports that deletion happened.
 *
 * These tests exist to make that failure loud. The malformed-pointer case is the load-bearing one.
 */

type Call = { op: "remove" | "list"; arg: unknown };

function fakeStorage(opts: {
  removeError?: string | null;
  chunkNames?: string[];
  listThrows?: boolean;
} = {}): { storage: RecordingStorage; calls: Call[] } {
  const calls: Call[] = [];
  const storage: RecordingStorage = {
    from(bucket: string) {
      expect(bucket).toBe(ASSETS_BUCKET);
      return {
        async remove(paths: string[]) {
          calls.push({ op: "remove", arg: paths });
          return { error: opts.removeError ? { message: opts.removeError } : null };
        },
        async list(prefix: string) {
          calls.push({ op: "list", arg: prefix });
          if (opts.listThrows) throw new Error("storage list blew up");
          return { data: (opts.chunkNames ?? []).map((name) => ({ name })), error: null };
        },
      };
    },
  };
  return { storage, calls };
}

const OK_URL = `${ASSETS_BUCKET}/comp-1/sess-1/recording.webm`;

describe("removeRecordingAudio", () => {
  it("removes the object at the bucket-relative path", async () => {
    const { storage, calls } = fakeStorage();
    const result = await removeRecordingAudio(storage, {
      audioAssetUrl: OK_URL,
      companyId: "comp-1",
      sessionId: "sess-1",
    });
    expect(result).toEqual({ ok: true, chunksRemoved: 0 });
    expect(calls[0]).toEqual({ op: "remove", arg: ["comp-1/sess-1/recording.webm"] });
  });

  it("REFUSES a pointer it does not recognise, rather than reporting a deletion that did not happen", async () => {
    // The dangerous branch: remove() on a bogus path returns no error, so a caller that pressed on would clear
    // the column and leave the audio alive, unreferenced and unfindable, having reported success.
    const { storage, calls } = fakeStorage();
    const result = await removeRecordingAudio(storage, {
      audioAssetUrl: "https://example.supabase.co/storage/v1/object/public/whatever.webm",
      companyId: "comp-1",
      sessionId: "sess-1",
    });
    expect(result).toEqual({ ok: false, reason: "malformed-pointer" });
    expect(calls).toHaveLength(0);
  });

  it("treats an object that is already gone as SUCCESS — the end state is what was wanted", async () => {
    for (const message of ["Object not found", "The resource does not exist"]) {
      const { storage } = fakeStorage({ removeError: message });
      const result = await removeRecordingAudio(storage, {
        audioAssetUrl: OK_URL,
        companyId: "comp-1",
        sessionId: "sess-1",
      });
      expect(result.ok).toBe(true);
    }
  });

  it("reports a REAL storage failure, so the caller leaves the pointer naming a live asset", async () => {
    const { storage } = fakeStorage({ removeError: "permission denied" });
    const result = await removeRecordingAudio(storage, {
      audioAssetUrl: OK_URL,
      companyId: "comp-1",
      sessionId: "sess-1",
    });
    expect(result).toEqual({ ok: false, reason: "storage-failed", message: "permission denied" });
  });

  it("also removes the orphaned chunk objects, under the SESSION id", async () => {
    const { storage, calls } = fakeStorage({ chunkNames: ["0.webm", "1.webm"] });
    const result = await removeRecordingAudio(storage, {
      audioAssetUrl: OK_URL,
      companyId: "comp-1",
      sessionId: "sess-1",
    });
    expect(result).toEqual({ ok: true, chunksRemoved: 2 });
    expect(calls).toContainEqual({ op: "list", arg: "comp-1/sess-1/chunks" });
    expect(calls).toContainEqual({
      op: "remove",
      arg: ["comp-1/sess-1/chunks/0.webm", "comp-1/sess-1/chunks/1.webm"],
    });
  });

  it("still succeeds when the chunk cleanup blows up — orphan chunks are wasteful, not harmful", async () => {
    // If a chunk failure blocked success, the row would keep a pointer to an object that is already gone and
    // retry forever.
    const { storage } = fakeStorage({ listThrows: true });
    const result = await removeRecordingAudio(storage, {
      audioAssetUrl: OK_URL,
      companyId: "comp-1",
      sessionId: "sess-1",
    });
    expect(result).toEqual({ ok: true, chunksRemoved: 0 });
  });

  it("skips chunk cleanup when there is no company id, rather than guessing a prefix", async () => {
    const { storage, calls } = fakeStorage({ chunkNames: ["0.webm"] });
    const result = await removeRecordingAudio(storage, {
      audioAssetUrl: OK_URL,
      companyId: null,
      sessionId: "sess-1",
    });
    expect(result).toEqual({ ok: true, chunksRemoved: 0 });
    expect(calls.filter((c) => c.op === "list")).toHaveLength(0);
  });
});

/**
 * Erasure's strict version (2026-11-23, CLAUDE.md §3.1.1 item 2). A stateful fake: the bucket holds objects, list
 * returns what is under a prefix (capped), remove deletes them — so "until the listing is empty" is really exercised.
 */
function bucketWith(paths: string[], opts: { cap?: number; listError?: string; removeError?: string } = {}) {
  const held = new Set(paths);
  const removed: string[][] = [];
  const storage: RecordingStorage = {
    from() {
      return {
        async remove(ps: string[]) {
          removed.push(ps);
          if (opts.removeError) return { error: { message: opts.removeError } };
          for (const x of ps) held.delete(x);
          return { error: null };
        },
        async list(prefix: string, o?: { limit?: number }) {
          if (opts.listError) return { data: null, error: { message: opts.listError } };
          const under = [...held].filter((x) => x.startsWith(`${prefix}/`)).map((x) => ({ name: x.slice(prefix.length + 1) }));
          return { data: under.slice(0, Math.min(o?.limit ?? 100, opts.cap ?? Infinity)), error: null };
        },
      };
    },
  };
  return { storage, held, removed };
}

describe("removeSessionChunks (erasure: strict)", () => {
  const ids = { companyId: "comp-1", sessionId: "sess-1" };

  it("removes every chunk, past a capped listing, and the canonical stitched file", async () => {
    const chunks = Array.from({ length: 7 }, (_, i) => `comp-1/sess-1/chunks/${i}.webm`);
    const { storage, held, removed } = bucketWith([...chunks, "comp-1/sess-1/recording.webm", "comp-1/other/chunks/0.webm"], { cap: 3 });
    expect(await removeSessionChunks(storage, ids)).toEqual({ ok: true, removed: 7 });
    expect([...held]).toEqual(["comp-1/other/chunks/0.webm"]); // another session's audio is untouched
    expect(removed.at(-1)).toEqual(["comp-1/sess-1/recording.webm"]);
  });

  it("succeeds on a call with nothing stored — the end state is already true", async () => {
    const { storage } = bucketWith([]);
    expect(await removeSessionChunks(storage, ids)).toEqual({ ok: true, removed: 0 });
  });

  it("FAILS when the chunks cannot be listed — unlike removeRecordingAudio's best-effort cleanup", async () => {
    const { storage } = bucketWith(["comp-1/sess-1/chunks/0.webm"], { listError: "denied" });
    expect(await removeSessionChunks(storage, ids)).toMatchObject({ ok: false, reason: "storage-failed" });
  });

  it("FAILS when storage refuses to remove them", async () => {
    const { storage } = bucketWith(["comp-1/sess-1/chunks/0.webm"], { removeError: "quota" });
    expect(await removeSessionChunks(storage, ids)).toMatchObject({ ok: false, reason: "storage-failed", message: "quota" });
  });

  it("does not loop forever when chunks never go away", async () => {
    let lists = 0;
    const storage: RecordingStorage = {
      from: () => ({
        remove: async () => ({ error: null }),
        list: async () => {
          lists++;
          return { data: [{ name: "0.webm" }], error: null };
        },
      }),
    };
    expect(await removeSessionChunks(storage, ids)).toMatchObject({ ok: false, reason: "storage-failed" });
    expect(lists).toBe(20);
  });
});
