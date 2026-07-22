import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { synthesizeSpeechStream } from "../elevenlabs";

/**
 * ElevenLabs TTS client (Jeff's voice). Two genuine properties worth locking: the cost/latency guardrail —
 * text over TTS_MAX_CHARS (800) is truncated BEFORE the request, at the nearest sentence break so playback
 * doesn't end mid-word — and the error mapping (401 → a user-friendly message, other statuses → a descriptive
 * error). A truncation regression is a real cost overrun.
 */

function fetchReturning(result: { ok: boolean; status?: number; body?: unknown; text?: string }) {
  // "body" in result respects an EXPLICIT null (?? would wrongly coalesce it to the default).
  const body = "body" in result ? result.body : result.ok ? "STREAM" : null;
  return vi.fn(async () => ({
    ok: result.ok,
    status: result.status ?? (result.ok ? 200 : 500),
    body,
    text: async () => result.text ?? "",
  }));
}
// Read back the JSON body sent to ElevenLabs from the fetch mock.
const sentText = (f: ReturnType<typeof vi.fn>) => JSON.parse((f.mock.calls[0]?.[1] as { body: string }).body).text as string;

beforeEach(() => {
  vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("synthesizeSpeechStream — cost guardrail (truncation)", () => {
  it("passes short text through unchanged", async () => {
    const f = fetchReturning({ ok: true });
    vi.stubGlobal("fetch", f);
    await synthesizeSpeechStream({ text: "hello there" });
    expect(sentText(f)).toBe("hello there");
  });

  it("truncates over-cap text at the nearest sentence break", async () => {
    const f = fetchReturning({ ok: true });
    vi.stubGlobal("fetch", f);
    // ". " at index 700 (well past the 50%-of-cap floor of 400) → cut just after it
    const text = "x".repeat(700) + ". " + "y".repeat(300);
    await synthesizeSpeechStream({ text });
    expect(sentText(f)).toBe("x".repeat(700) + ".");
  });

  it("hard-cuts at the cap when there's no usable sentence break", async () => {
    const f = fetchReturning({ ok: true });
    vi.stubGlobal("fetch", f);
    await synthesizeSpeechStream({ text: "z".repeat(1000) });
    expect(sentText(f).length).toBe(800);
  });
});

describe("synthesizeSpeechStream — error mapping", () => {
  it("maps 401 to a user-friendly message (not a raw provider error)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchReturning({ ok: false, status: 401, text: "bad key" }));
    await expect(synthesizeSpeechStream({ text: "hi" })).rejects.toThrow("Voice isn't available right now.");
  });

  it("surfaces the status on other failures", async () => {
    vi.stubGlobal("fetch", fetchReturning({ ok: false, status: 500, text: "boom" }));
    await expect(synthesizeSpeechStream({ text: "hi" })).rejects.toThrow(/ElevenLabs TTS failed: 500/);
  });

  it("errors clearly when the response has no body", async () => {
    vi.stubGlobal("fetch", fetchReturning({ ok: true, body: null }));
    await expect(synthesizeSpeechStream({ text: "hi" })).rejects.toThrow(/no response body/);
  });
});
