import { describe, it, expect } from "vitest";
import { removeRecordingAudio, type RecordingStorage } from "../removeRecordingAudio";
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
