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
  uploadedContentType: null as string | null, // contentType the stitch stamped on the final recording
  chunkContentType: "audio/webm" as string, // what the stored chunks are labeled (iOS = audio/mp4)
  stamped: false,
  headerSeqs: new Set<number>(), // seqs whose downloaded bytes begin with a NEW webm header (recreated recorder)
  mp4HeaderSeqs: new Set<number>(), // seqs that begin with a NEW mp4 ftyp init (iOS recreated recorder)
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
        upload: async (path: string, _bytes: unknown, opts?: { contentType?: string }) => {
          state.uploaded.push(path);
          state.uploadedContentType = opts?.contentType ?? null;
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
      : state.mp4HeaderSeqs.has(seq)
        ? Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 9, 9]) // a NEW mp4 ftyp init — iOS recreated recorder
        : Buffer.from([1, 2, 3]);
    return { ok: true, bytes, contentType: state.chunkContentType };
  },
}));

const { orderedChunkSeqs, startsWithEbmlHeader, startsWithMp4InitSegment, startsWithNewRecordingHeader, findSecondInitSegment, truncateAtSecondInitSegment, describeAudioBytes, stitchSessionAudio, chunkPrefix, chunkObjectPath, finalRecordingPath } = await import("../stitchSessionAudio");

beforeEach(() => {
  state.audioUrl = null;
  state.chunkNames = [];
  state.uploaded = [];
  state.uploadedContentType = null;
  state.chunkContentType = "audio/webm";
  state.stamped = false;
  state.headerSeqs = new Set<number>();
  state.mp4HeaderSeqs = new Set<number>();
});

describe("startsWithEbmlHeader — detect a new webm recording (recreated-recorder seam)", () => {
  it("is true only for the EBML magic 0x1A45DFA3", () => {
    expect(startsWithEbmlHeader(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe(true);
    expect(startsWithEbmlHeader(Buffer.from([0x1f, 0x43, 0xb6, 0x75]))).toBe(false); // a Cluster (media segment)
    expect(startsWithEbmlHeader(Buffer.from([0x1a, 0x45]))).toBe(false); // too short
    expect(startsWithEbmlHeader(Buffer.from([]))).toBe(false);
  });
});

// The iOS mp4 twin — the gap that caused ElevenLabs "invalid_audio / corrupted" (2026-08-25): iOS records
// audio/mp4, and the old webm-only reseam let two mp4 init segments concatenate into an unplayable file.
const FTYP = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0, 0]); // box size 0x18, "ftyp" at offset 4
const EBML = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]);

describe("startsWithMp4InitSegment — detect a new mp4 recording (ftyp init)", () => {
  it("is true only for an ftyp box (type bytes at offset 4)", () => {
    expect(startsWithMp4InitSegment(FTYP)).toBe(true);
    expect(startsWithMp4InitSegment(EBML)).toBe(false); // webm, not mp4
    expect(startsWithMp4InitSegment(Buffer.from([0, 0, 0, 0x18, 0x6d, 0x6f, 0x6f, 0x66]))).toBe(false); // "moof" = a continuation fragment, NOT a new recording
    expect(startsWithMp4InitSegment(Buffer.from([0, 0, 0, 0x18]))).toBe(false); // too short
  });
});

describe("startsWithNewRecordingHeader — webm OR mp4 recording start", () => {
  it("matches both container init headers, nothing else", () => {
    expect(startsWithNewRecordingHeader(EBML)).toBe(true);
    expect(startsWithNewRecordingHeader(FTYP)).toBe(true);
    expect(startsWithNewRecordingHeader(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(false); // a media fragment
  });
});

describe("findSecondInitSegment / describeAudioBytes — the bad-concat fingerprint (ground-truth capture)", () => {
  it("finds a SECOND webm/mp4 init header concatenated in, and -1 for a clean file", () => {
    expect(findSecondInitSegment(Buffer.concat([EBML, Buffer.from([5, 6, 7, 8])]))).toBe(-1); // single recording
    // webm+webm and mp4+mp4 bad concats: the second header sits mid-file, past the first.
    expect(findSecondInitSegment(Buffer.concat([EBML, Buffer.from([5, 6]), EBML]))).toBeGreaterThan(0);
    expect(findSecondInitSegment(Buffer.concat([FTYP, Buffer.from([5, 6]), FTYP]))).toBeGreaterThan(4);
  });
  it("describeAudioBytes reports size/ct/head and flags a bad concat", () => {
    const clean = describeAudioBytes(FTYP, "audio/mp4");
    expect(clean).toContain("size=10");
    expect(clean).toContain("ct=audio/mp4");
    expect(clean).not.toContain("bad-concat");
    expect(describeAudioBytes(Buffer.concat([FTYP, Buffer.from([5, 6]), FTYP]), "audio/mp4")).toContain("bad-concat");
  });
});

describe("truncateAtSecondInitSegment — LAST-RESORT recovery: keep the valid FIRST segment of a bad concat", () => {
  it("returns just the first segment when a second init is concatenated in (webm and mp4)", () => {
    const webmConcat = Buffer.concat([EBML, Buffer.from([5, 6]), EBML]); // second EBML @ byte 8
    expect(truncateAtSecondInitSegment(webmConcat)).toEqual(webmConcat.subarray(0, 8)); // the first recording only
    const mp4Concat = Buffer.concat([FTYP, Buffer.from([5, 6]), FTYP]); // second ftyp mid-file
    const salvaged = truncateAtSecondInitSegment(mp4Concat)!;
    expect(salvaged.length).toBe(findSecondInitSegment(mp4Concat)); // cut exactly at the second init
    expect(startsWithMp4InitSegment(salvaged)).toBe(true); // …and the head is still a valid mp4 start
  });
  it("returns null for a clean single recording (nothing to salvage — never truncate a good file)", () => {
    expect(truncateAtSecondInitSegment(Buffer.concat([EBML, Buffer.from([5, 6, 7, 8])]))).toBe(null);
    expect(truncateAtSecondInitSegment(FTYP)).toBe(null);
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

  it("stops at a NEW mp4 ftyp init mid-stream (iOS recorder recreated) — the 2026-08-25 corrupted-audio fix", async () => {
    state.chunkNames = ["0.webm", "1.webm", "2.webm", "3.webm"];
    state.mp4HeaderSeqs = new Set([2]); // seq 2 begins a fresh iOS mp4 recording — the old webm-only reseam missed this
    const r = await stitchSessionAudio({ companyId: "co", sessionId: "s1" });
    expect(r.stitched).toBe(true);
    expect(r.bytes).toBe(6); // seqs 0 + 1 only — the mp4 seam at 2 is NOT crossed (no two-init unplayable file)
  });

  // DRIFT GUARD (A30) — the stitched recording must be labeled with the chunks' ACTUAL format, mirroring the
  // DoorLog twin stitchPitchAudio (fixed 2026-08-23). Hardcoding audio/webm mislabeled an iOS mp4 recording that
  // reached the stitch (drop/phone-lock durability path), so downloadAssetBytes read it back as webm and the
  // worker/dissect handed mp4 bytes to STT labeled webm. The clean-Stop persist already used blob.type; only the
  // stitch drifted. If this regresses to a hardcoded type, iOS coaching audio silently mislabels again.
  it("labels the stitched recording with the chunks' real content-type (iOS mp4, NOT hardcoded webm)", async () => {
    state.chunkNames = ["0.webm", "1.webm"];
    state.chunkContentType = "audio/mp4"; // iOS Safari records mp4 even though the storage KEY stays .webm-suffixed
    const r = await stitchSessionAudio({ companyId: "co", sessionId: "s1" });
    expect(r.stitched).toBe(true);
    expect(state.uploadedContentType).toBe("audio/mp4"); // preserved from the chunk, not overridden to webm
  });

  it("keeps audio/webm for a webm recording (the non-iOS pipeline default is untouched)", async () => {
    state.chunkNames = ["0.webm", "1.webm"];
    state.chunkContentType = "audio/webm";
    const r = await stitchSessionAudio({ companyId: "co", sessionId: "s1" });
    expect(r.stitched).toBe(true);
    expect(state.uploadedContentType).toBe("audio/webm");
  });
});
