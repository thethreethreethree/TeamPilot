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
  downloadAssetBytes: vi.fn(async () => ({ ok: true, bytes: Buffer.from("x"), contentType: "audio/webm" })),
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
  claimPitchForProcessing: vi.fn(async () => true), // won the lease by default
}));

import { transcribeSpeech } from "@/lib/care/voice/elevenlabs";
import { writePitchAnalysis, claimPitchForProcessing } from "@/lib/data/doorlog";
import { processPitch } from "../worker";

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
    vi.mocked(claimPitchForProcessing).mockResolvedValueOnce(false); // another worker already owns this pitch
    await processPitch({ ...PITCH });
    expect(transcribeSpeech).not.toHaveBeenCalled();
    expect(writePitchAnalysis).not.toHaveBeenCalled();
  });
});
