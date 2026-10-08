import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * recoverSessionTranscript keeps WHICH VOICE said each line (2026-10-08). When the rep's voice is not decided every
 * line is saved 'unknown', and the diarizer's voice id is then the only record of who said what. It was dropped
 * here, so the later "whose voice is this?" could only relabel every line one way (A39). The save now carries it.
 */
vi.mock("@/lib/data/salesCoach", () => ({
  getSession: vi.fn(async () => ({ id: "sess1", audioAssetUrl: "asset://a.webm", startedAt: "2026-10-01T10:00:00Z" })),
  getSessionTranscript: vi.fn(async () => [{ speaker: "unknown", text: "hm", seq: 0, source: null }]),
  replaceSessionTranscript: vi.fn(async () => ({ ok: true, count: 3 })),
}));
vi.mock("@/lib/storage/assets", () => ({
  assetUrlToStoragePath: () => "co1/a.webm",
  downloadAssetBytes: vi.fn(async () => ({ ok: true, bytes: Buffer.from([1, 2, 3]), contentType: "audio/webm" })),
}));
vi.mock("@/lib/care/voice/elevenlabs", () => ({
  transcribeWithDiarization: vi.fn(async () => ({
    durationSeconds: 0,
    segments: [
      { speakerId: "speaker_0", text: "Hi, I'm with Elostate.", start: 0 },
      { speakerId: "speaker_1", text: "What does it cost?", start: 2 },
      { speakerId: "speaker_0", text: "Fifty a month.", start: 4 },
    ],
  })),
}));
vi.mock("../autoSpeakerAssign", () => ({ autoAssignAgentCluster: vi.fn(() => ({ decided: false, reason: "ambiguous" })) }));
vi.mock("../generateSessionArtifacts", () => ({ generateSessionArtifacts: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["update", "eq", "is", "not", "limit", "order", "insert", "from"]) chain[m] = () => chain;
    // The one-attempt claim returns its row; every other read resolves empty.
    chain.select = (cols?: string) => (cols === "id" ? Promise.resolve({ data: [{ id: "sess1" }], error: null }) : chain);
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null, count: 0 });
    return chain;
  },
}));

import { replaceSessionTranscript } from "@/lib/data/salesCoach";
import { autoAssignAgentCluster } from "../autoSpeakerAssign";
import { recoverSessionTranscript } from "../transcriptRecovery";

const run = () =>
  recoverSessionTranscript({ sessionId: "sess1", companyId: "co1", actorId: "rep1", db: {} as never } as Parameters<
    typeof recoverSessionTranscript
  >[0]);

beforeEach(() => vi.clearAllMocks());

describe("recoverSessionTranscript keeps each line's voice", () => {
  it("saves the diarizer's voice id on every line when the rep's voice is NOT decided", async () => {
    await run();
    const saved = vi.mocked(replaceSessionTranscript).mock.calls[0]?.[1];
    expect(saved?.map((l) => [l.speaker, l.speakerId])).toEqual([
      ["unknown", "speaker_0"],
      ["unknown", "speaker_1"],
      ["unknown", "speaker_0"],
    ]);
  });

  it("keeps it when the rep's voice IS decided, too", async () => {
    vi.mocked(autoAssignAgentCluster).mockReturnValueOnce({ decided: true, agentSpeakerId: "speaker_1" } as never);
    await run();
    const saved = vi.mocked(replaceSessionTranscript).mock.calls[0]?.[1];
    expect(saved?.map((l) => [l.speaker, l.speakerId])).toEqual([
      ["customer", "speaker_0"],
      ["agent", "speaker_1"],
      ["customer", "speaker_0"],
    ]);
  });
});
