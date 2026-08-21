import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Incremental-audio stitch (founder 2026-08-21 "never lose the recording"). Two properties matter most:
 *  - orderedChunkSeqs: byte-concat validity depends on a CONTIGUOUS run from 0 (a gap truncates the tail, never
 *    corrupts the head); dups + non-numeric names are ignored.
 *  - stitchSessionAudio is IDEMPOTENT: it never overwrites an audio pointer a clean Stop (or a prior stitch)
 *    already set, and no-ops when there are no chunks — so running it from the cron on every closed session is
 *    safe and cheap.
 */

const state = vi.hoisted(() => ({
  audioUrl: null as string | null,
  chunkNames: [] as string[],
  uploaded: [] as string[],
  stamped: false,
  headerSeqs: new Set<number>(), // seqs whose downloaded bytes begin with a NEW webm header (recreated recorder)
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { audio_asset_url: state.audioUrl }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          is: () => ({
            select: async () => {
              state.stamped = true;
              return { data: [{ id: "s1" }], error: null };
            },
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        list: async () => ({ data: state.chunkNames.map((name) => ({ name })), error: null }),
        upload: async (path: string) => {
          state.uploaded.push(path);
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
  }),
}));
vi.mock("@/lib/storage/assets", () => ({
  ASSETS_BUCKET: "assets-v1",
  downloadAssetBytes: async ({ storagePath }: { storagePath: string }) => {
    const seq = Number(storagePath.match(/\/(\d+)\.webm$/)?.[1] ?? -1);
    const bytes = state.headerSeqs.has(seq)
      ? Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 9, 9]) // a NEW webm header — a recreated-recorder segment
      : Buffer.from([1, 2, 3]);
    return { ok: true, bytes };
  },
}));

const { orderedChunkSeqs, startsWithEbmlHeader, stitchSessionAudio, chunkPrefix, chunkObjectPath, finalRecordingPath } = await import("../stitchSessionAudio");

beforeEach(() => {
  state.audioUrl = null;
  state.chunkNames = [];
  state.uploaded = [];
  state.stamped = false;
  state.headerSeqs = new Set<number>();
});

describe("startsWithEbmlHeader — detect a new webm recording (recreated-recorder seam)", () => {
  it("is true only for the EBML magic 0x1A45DFA3", () => {
    expect(startsWithEbmlHeader(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe(true);
    expect(startsWithEbmlHeader(Buffer.from([0x1f, 0x43, 0xb6, 0x75]))).toBe(false); // a Cluster (media segment)
    expect(startsWithEbmlHeader(Buffer.from([0x1a, 0x45]))).toBe(false); // too short
    expect(startsWithEbmlHeader(Buffer.from([]))).toBe(false);
  });
});

describe("audio chunk storage-path contract (single source — route WRITES, stitch READS, purge CLEANS)", () => {
  // A drift between these three consumers silently loses the audio (written to one path, sought from another).
  it("chunkObjectPath = chunkPrefix + /<seq>.webm, and the final recording sits beside the chunks folder", () => {
    expect(chunkPrefix("co", "s1")).toBe("co/s1/chunks");
    expect(chunkObjectPath("co", "s1", 7)).toBe("co/s1/chunks/7.webm");
    expect(chunkObjectPath("co", "s1", 7).startsWith(chunkPrefix("co", "s1") + "/")).toBe(true);
    expect(finalRecordingPath("co", "s1")).toBe("co/s1/recording.webm");
  });
});

describe("orderedChunkSeqs", () => {
  it("returns the contiguous run from 0", () => {
    expect(orderedChunkSeqs(["0.webm", "1.webm", "2.webm"])).toEqual([0, 1, 2]);
  });
  it("stops at the first gap — tail truncated, head kept", () => {
    expect(orderedChunkSeqs(["0.webm", "1.webm", "3.webm", "4.webm"])).toEqual([0, 1]);
  });
  it("ignores dups, non-numeric names, and unsorted input", () => {
    expect(orderedChunkSeqs(["2.webm", "0.webm", "1.webm", "1.webm", "junk.webm"])).toEqual([0, 1, 2]);
  });
  it("returns [] when empty or seq 0 is missing (nothing playable)", () => {
    expect(orderedChunkSeqs([])).toEqual([]);
    expect(orderedChunkSeqs(["1.webm", "2.webm"])).toEqual([]);
  });
});

describe("stitchSessionAudio idempotency + safety", () => {
  it("SKIPS when audio_asset_url is already set (never clobbers a clean-Stop persist)", async () => {
    state.audioUrl = "assets-v1/co/s1/recording.webm";
    state.chunkNames = ["0.webm", "1.webm"];
    const r = await stitchSessionAudio({ companyId: "co", sessionId: "s1" });
    expect(r.stitched).toBe(false);
    expect(r.reason).toMatch(/already/i);
    expect(state.uploaded).toHaveLength(0); // nothing written
    expect(state.stamped).toBe(false);
  });

  it("no-ops cheaply when there are no chunks (a pre-feature / never-recorded session)", async () => {
    state.chunkNames = [];
    const r = await stitchSessionAudio({ companyId: "co", sessionId: "s1" });
    expect(r.stitched).toBe(false);
    expect(r.reason).toMatch(/no chunks/i);
    expect(state.uploaded).toHaveLength(0);
  });

  it("stitches + stamps when there are contiguous chunks and no prior audio", async () => {
    state.chunkNames = ["0.webm", "1.webm", "2.webm"];
    const r = await stitchSessionAudio({ companyId: "co", sessionId: "s1" });
    expect(r.stitched).toBe(true);
    expect(state.uploaded).toEqual(["co/s1/recording.webm"]);
    expect(state.stamped).toBe(true);
  });

  it("stops at a NEW webm header mid-stream (recorder recreated by a mobile lock) — keeps the first segment", async () => {
    state.chunkNames = ["0.webm", "1.webm", "2.webm", "3.webm"];
    state.headerSeqs = new Set([2]); // seq 2 begins a fresh recording; concatenating past it would corrupt the webm
    const r = await stitchSessionAudio({ companyId: "co", sessionId: "s1" });
    expect(r.stitched).toBe(true);
    // Only seqs 0 + 1 (the valid first segment, two 3-byte chunks) are concatenated — the seam at 2 is not crossed.
    expect(r.bytes).toBe(6);
  });
});
