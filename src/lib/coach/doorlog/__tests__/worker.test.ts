import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pitch-processing worker — the GATE for F4 (audit 2026-08-18): a retry after an analyze-stage failure
 * must NOT re-run the paid ElevenLabs STT. Transcription is gated on transcript-EXISTENCE, not the
 * volatile claim-time status, so a pitch that already has a transcript skips straight to analysis.
 */
const scripts: Record<string, unknown> = {};

function fakeChain(table: string) {
  const chain: Record<string, unknown> = { __cols: "" };
  chain.select = (cols: string) => {
    (chain as { __cols: string }).__cols = cols;
    return chain;
  };
  for (const m of ["eq", "in", "lte", "order", "limit", "update"]) chain[m] = () => chain;
  chain.upsert = async () => ({ error: null });
  chain.maybeSingle = async () => ({
    data: scripts[`${table}:${(chain as { __cols: string }).__cols}`] ?? null,
  });
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => fakeChain(table) }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/care/voice/elevenlabs", () => ({ transcribeSpeech: vi.fn(async () => "fresh transcript") }));
vi.mock("@/lib/storage/assets", () => ({
  // Default: a VALID-header webm recording (EBML magic) so it passes the worker's playable-container guard and
  // reaches STT. Tests that need an empty/unplayable/bad-concat recording override this per-case.
  downloadAssetBytes: vi.fn(async () => ({ ok: true, bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]), contentType: "audio/webm" })),
}));
vi.mock("@/lib/coach/doorlog/analyze", () => ({
  ANALYSIS_PROMPT_VERSION: "v1",
  analyzePitch: vi.fn(async () => ({ summary: "ok", strengths: [], improvements: [], scores: {} })),
}));
vi.mock("@/lib/data/doorlog", () => ({
  writePitchTranscript: vi.fn(async () => {}),
  writePitchAnalysis: vi.fn(async () => {}),
  setPitchStatus: vi.fn(async () => {}),
  claimPitchesToProcess: vi.fn(async () => []),
  // Won the lease by default; the lease advances attempts (H2), so return the incremented count.
  claimPitchForProcessing: vi.fn(async (_id: string, current = 0) => ({ won: true, attempts: current + 1 })),
}));
// after() runs the callback synchronously here so the completion-path rollup kick is observable.
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("../rollupWorker", () => ({ rollupRep: vi.fn(async () => {}) }));

import { transcribeSpeech } from "@/lib/care/voice/elevenlabs";
import { downloadAssetBytes } from "@/lib/storage/assets";
import { writePitchAnalysis, writePitchTranscript, setPitchStatus, claimPitchForProcessing } from "@/lib/data/doorlog";
import { analyzePitch } from "@/lib/coach/doorlog/analyze";
import { rollupRep } from "../rollupWorker";
import { processPitch } from "../worker";

/** Did any setPitchStatus call mark this pitch terminally failed with a message matching `re`? */
function failedWith(re: RegExp): boolean {
  return vi.mocked(setPitchStatus).mock.calls.some(
    ([a]) => a?.status === "failed" && re.test(String(a?.error ?? "")),
  );
}

const PITCH = {
  id: "p1",
  company_id: "co1",
  rep_id: "rep1",
  audio_path: "co1/2026/08/p1.webm",
  status: "uploading",
  attempts: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(scripts)) delete scripts[k];
  // Both tests need the analyze inputs available.
  scripts["pitch_transcripts:text"] = { text: "the pitch transcript" };
  scripts["pitches:duration_ms, door_knocks!inner(outcome)"] = {
    duration_ms: 5000,
    door_knocks: { outcome: "sold" },
  };
});

describe("processPitch — F4 skip-transcribe-if-exists", () => {
  it("SKIPS ElevenLabs STT when a transcript already exists (no re-spend on an analyze retry)", async () => {
    scripts["pitch_transcripts:pitch_id"] = { pitch_id: "p1" }; // transcript already exists
    await processPitch({ ...PITCH });
    expect(transcribeSpeech).not.toHaveBeenCalled(); // THE GATE
    expect(writePitchAnalysis).toHaveBeenCalledTimes(1); // still analyzes
  });

  it("runs STT when there is NO transcript yet", async () => {
    scripts["pitch_transcripts:pitch_id"] = null; // no transcript
    await processPitch({ ...PITCH });
    expect(transcribeSpeech).toHaveBeenCalledTimes(1);
  });

  // Audit 2026-08-19: the route's fire-and-forget kick AND the cron sweep both reach processPitch; without an
  // atomic claim both read "no transcript yet" and each run the paid STT + LLM. The loser of the lease must spend
  // nothing.
  it("does NO paid work when it loses the atomic claim (double-processing prevented)", async () => {
    scripts["pitch_transcripts:pitch_id"] = null; // no transcript — would otherwise transcribe
    vi.mocked(claimPitchForProcessing).mockResolvedValueOnce({ won: false, attempts: 0 }); // another worker owns it
    await processPitch({ ...PITCH });
    expect(transcribeSpeech).not.toHaveBeenCalled();
    expect(writePitchAnalysis).not.toHaveBeenCalled();
  });
});

describe("processPitch — H1: empty/silent audio never fabricates a 'complete' analysis (founder 2026-08-22)", () => {
  it("STT returns no words → terminal 'No speech detected', NEVER analyzed or written complete", async () => {
    scripts["pitch_transcripts:pitch_id"] = null; // no transcript yet → runs STT
    vi.mocked(transcribeSpeech).mockResolvedValueOnce("   "); // silence → empty transcript
    await processPitch({ ...PITCH });
    expect(failedWith(/no speech was detected/i)).toBe(true);
    expect(writePitchTranscript).not.toHaveBeenCalled(); // no empty transcript persisted
    expect(analyzePitch).not.toHaveBeenCalled(); // NEVER analyze empty input
    expect(writePitchAnalysis).not.toHaveBeenCalled(); // and NEVER a hollow 'complete'
  });

  it("a 0-byte / empty audio download → terminal 'No audio', never sent to STT", async () => {
    scripts["pitch_transcripts:pitch_id"] = null;
    vi.mocked(downloadAssetBytes).mockResolvedValueOnce({ ok: true, bytes: Buffer.alloc(0), contentType: "audio/webm" });
    await processPitch({ ...PITCH });
    expect(failedWith(/no audio was captured/i)).toBe(true);
    expect(transcribeSpeech).not.toHaveBeenCalled(); // empty Buffer is truthy — the LENGTH guard catches it
    expect(analyzePitch).not.toHaveBeenCalled();
  });

  // Ground truth 2026-08-25: a near-empty capture on the single-blob fallback produced a NON-empty but unplayable
  // 5-byte webm Cues stub (head 1c53bb6b, no valid container header). It passed the length guard and was sent to
  // STT → ElevenLabs "invalid_audio/corrupted" — a misleading error for what is really an EMPTY capture.
  it("a NON-empty but HEADERLESS recording (unplayable stub) → honest terminal, never sent to STT", async () => {
    scripts["pitch_transcripts:pitch_id"] = null;
    vi.mocked(downloadAssetBytes).mockResolvedValueOnce({ ok: true, bytes: Buffer.from([0x1c, 0x53, 0xbb, 0x6b, 0x80]), contentType: "audio/webm" });
    await processPitch({ ...PITCH });
    expect(failedWith(/empty or unplayable/i)).toBe(true); // the TRUE cause, not a relayed "corrupted"
    expect(transcribeSpeech).not.toHaveBeenCalled(); // no wasted STT on an unplayable file
    expect(analyzePitch).not.toHaveBeenCalled();
  });

  it("a previously-persisted EMPTY transcript is not analyzed either (defense-in-depth)", async () => {
    scripts["pitch_transcripts:pitch_id"] = { pitch_id: "p1" }; // transcript row exists → skip STT
    scripts["pitch_transcripts:text"] = { text: "   " }; // …but it is empty
    await processPitch({ ...PITCH });
    expect(failedWith(/no speech was detected/i)).toBe(true);
    expect(analyzePitch).not.toHaveBeenCalled();
    expect(writePitchAnalysis).not.toHaveBeenCalled();
  });
});

describe("processPitch — H2: a crash/timeout loop terminalises instead of processing forever (founder 2026-08-22)", () => {
  it("does NO paid work and marks 'failed' when the lease shows attempts already PAST the ceiling (poison pitch)", async () => {
    scripts["pitch_transcripts:pitch_id"] = null; // would otherwise transcribe
    // A prior run hard-crashed (serverless timeout/OOM) without hitting the catch, so only the lease advanced
    // attempts — now the claim returns a count past MAX_PITCH_ATTEMPTS (5).
    vi.mocked(claimPitchForProcessing).mockResolvedValueOnce({ won: true, attempts: 6 });
    await processPitch({ ...PITCH, attempts: 5 });
    expect(failedWith(/timeout or crash prevented completion/i)).toBe(true);
    expect(transcribeSpeech).not.toHaveBeenCalled(); // spent nothing — it just crashes again
    expect(analyzePitch).not.toHaveBeenCalled();
  });

  it("a thrown error at the ceiling terminalises with the lease-set count (no double-increment)", async () => {
    scripts["pitch_transcripts:pitch_id"] = { pitch_id: "p1" }; // has transcript → straight to analyze
    vi.mocked(claimPitchForProcessing).mockResolvedValueOnce({ won: true, attempts: 5 }); // 5th (final) real try
    vi.mocked(analyzePitch).mockRejectedValueOnce(new Error("brain down"));
    await processPitch({ ...PITCH, attempts: 4 });
    // Terminal message names 5 (the lease count), NOT 6 — the catch must not re-increment.
    expect(failedWith(/after 5 attempts: brain down/i)).toBe(true);
  });
});

describe("processPitch — H3: a failed derived-table write is NEVER dressed as 'complete' (founder 2026-08-22)", () => {
  it("when writePitchAnalysis throws, the pitch does NOT reach 'complete' (retries instead)", async () => {
    scripts["pitch_transcripts:pitch_id"] = { pitch_id: "p1" }; // has transcript → straight to analyze
    vi.mocked(writePitchAnalysis).mockRejectedValueOnce(new Error("analysis upsert failed: deadlock"));
    await processPitch({ ...PITCH }); // claim default → attempts 1 → transient, backs off
    // Never a hollow complete; the catch routes it to a (non-terminal) backoff for the cron to re-claim.
    const completeCalls = vi.mocked(setPitchStatus).mock.calls.filter(([a]) => a?.status === "complete");
    expect(completeCalls).toHaveLength(0);
  });
});

// A recording stitched BEFORE the 2026-08-25 mp4-reseam fix may be a bad concat of two init segments (the shape
// ElevenLabs rejects as "corrupted"). Its chunks are purged, so a re-stitch can't help — but the cached bad file
// can be split at the second init and its valid FIRST segment transcribed. The recovery runs ONLY after STT has
// already rejected the full buffer, so it can never harm a good recording.
describe("processPitch — bad-concat recovery: salvage the first segment when STT rejects a two-init file", () => {
  const EBML = [0x1a, 0x45, 0xdf, 0xa3];
  const badConcat = Buffer.from([...EBML, 1, 2, 3, 4, ...EBML, 5, 6, 7, 8]); // second init @ byte 8
  const singleCorrupt = Buffer.from([...EBML, 1, 2, 3, 4, 5, 6]); // one recording, no second init

  it("retries STT with the truncated first segment and SUCCEEDS — pitch is not failed", async () => {
    scripts["pitch_transcripts:pitch_id"] = null; // no transcript → runs STT
    vi.mocked(downloadAssetBytes).mockResolvedValueOnce({ ok: true, bytes: badConcat, contentType: "audio/webm" });
    vi.mocked(transcribeSpeech)
      .mockRejectedValueOnce(new Error("ElevenLabs STT failed: 400 invalid_audio — File is corrupted"))
      .mockResolvedValueOnce("recovered transcript from the first segment");
    await processPitch({ ...PITCH });
    expect(transcribeSpeech).toHaveBeenCalledTimes(2); // full buffer rejected → retry with the salvaged head
    const firstLen = (vi.mocked(transcribeSpeech).mock.calls[0]?.[0].audio as Buffer).length;
    const secondLen = (vi.mocked(transcribeSpeech).mock.calls[1]?.[0].audio as Buffer).length;
    expect(secondLen).toBe(8); // truncated to the first init segment (bytes 0..8)
    expect(secondLen).toBeLessThan(firstLen);
    expect(writePitchTranscript).toHaveBeenCalledTimes(1); // the recovered text is persisted
    expect(failedWith(/corrupted|invalid_audio/i)).toBe(false); // NOT failed — it recovered
  });

  it("does NOT retry when the rejected audio has no second init (a genuine single-recording corruption)", async () => {
    scripts["pitch_transcripts:pitch_id"] = null;
    vi.mocked(downloadAssetBytes).mockResolvedValueOnce({ ok: true, bytes: singleCorrupt, contentType: "audio/webm" });
    vi.mocked(transcribeSpeech).mockRejectedValueOnce(new Error("ElevenLabs STT failed: 400 invalid_audio"));
    await processPitch({ ...PITCH }); // attempts 1 → transient, backs off (not terminal)
    expect(transcribeSpeech).toHaveBeenCalledTimes(1); // nothing to salvage → no wasted second call
    expect(writePitchTranscript).not.toHaveBeenCalled();
  });
});

describe("processPitch — the Next Door focus rollup fires on completion (founder 2026-08-22, 'never again')", () => {
  it("kicks the rep's pattern rollup after a pitch completes — so the focus generates without relying on the cron", async () => {
    scripts["pitch_transcripts:pitch_id"] = { pitch_id: "p1" }; // has transcript → straight to a clean complete
    await processPitch({ ...PITCH });
    expect(writePitchAnalysis).toHaveBeenCalledTimes(1); // it completed
    expect(rollupRep).toHaveBeenCalledTimes(1); // …and the rollup was kicked on the completion path
    expect(vi.mocked(rollupRep).mock.calls[0]?.[0]).toMatchObject({ companyId: "co1", repId: "rep1" });
  });

  it("does NOT kick the rollup when the pitch FAILS (empty transcript) — no focus refresh on a non-completion", async () => {
    scripts["pitch_transcripts:pitch_id"] = null;
    vi.mocked(transcribeSpeech).mockResolvedValueOnce(""); // empty → terminal failed, never completes
    await processPitch({ ...PITCH });
    expect(failedWith(/no speech was detected/i)).toBe(true);
    expect(rollupRep).not.toHaveBeenCalled();
  });
});
