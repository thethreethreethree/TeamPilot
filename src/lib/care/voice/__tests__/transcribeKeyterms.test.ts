import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The company vocabulary (0306) reaches batch transcription as REPEATED `keyterms` form fields — the encoding verified
 * live on 2026-11-22 (scribe_v1: repeated → 200; a JSON-encoded list → 400 invalid_keyword). No list → no field, so a
 * company that left it empty pays no surcharge.
 */
const fetchMock = vi.fn();
beforeEach(() => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ words: [], text: "" }), text: async () => "" });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("transcribeWithDiarization keyterms", () => {
  it("sends each term as its own form field", async () => {
    const { transcribeWithDiarization } = await import("../elevenlabs");
    await transcribeWithDiarization({ audio: Buffer.from([1, 2, 3]), mimeType: "audio/webm", keyterms: ["Spectrum", "AT&T Fiber"] }).catch(() => null);
    const form = fetchMock.mock.calls[0]![1].body as FormData;
    expect(form.getAll("keyterms")).toEqual(["Spectrum", "AT&T Fiber"]);
  });

  it("sends no keyterms field when the list is empty or absent", async () => {
    const { transcribeWithDiarization } = await import("../elevenlabs");
    await transcribeWithDiarization({ audio: Buffer.from([1]), mimeType: "audio/webm" }).catch(() => null);
    await transcribeWithDiarization({ audio: Buffer.from([1]), mimeType: "audio/webm", keyterms: [] }).catch(() => null);
    for (const [, init] of fetchMock.mock.calls) expect((init.body as FormData).getAll("keyterms")).toEqual([]);
  });
});
