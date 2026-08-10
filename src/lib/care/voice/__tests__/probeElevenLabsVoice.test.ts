import { describe, it, expect, afterEach, vi } from "vitest";
import { probeElevenLabsVoice } from "../elevenlabs";

/**
 * The voice-health probe must give an operator the EXACT cause of a live-coaching / transcription
 * outage. These pin the two cases that need no live provider: missing key, and a classified 4xx.
 */

const ORIG = process.env.ELEVENLABS_API_KEY;
afterEach(() => {
  process.env.ELEVENLABS_API_KEY = ORIG;
  vi.restoreAllMocks();
});

describe("probeElevenLabsVoice", () => {
  it("reports a MISSING key without any network call", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await probeElevenLabsVoice();
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/NOT set/i);
    expect(fetchSpy).not.toHaveBeenCalled(); // no key → no wasted provider call
  });

  it("flags a key ID (no sk_ prefix) up front via the format guard — the 2026-08-09 trap", async () => {
    process.env.ELEVENLABS_API_KEY = "ddfd9b9dae200120370ed2787fab80ddc16bb6eaeba20245f9ffa10d3e31349a";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"detail":{"status":"api_key_id_used_as_api_key"}}', { status: 400 }),
    );
    const r = await probeElevenLabsVoice();
    expect(r.ok).toBe(false);
    const fmt = r.checks.find((c) => c.name === "key-format");
    expect(fmt?.ok).toBe(false);
    expect(fmt?.detail).toMatch(/does NOT start with "sk_"/);
  });

  it("classifies a 401 missing-permission as a SCOPE problem (not a wrong key)", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"detail":{"status":"missing_permissions"}}', { status: 401 }),
    );
    const r = await probeElevenLabsVoice();
    expect(r.ok).toBe(false);
    // both checks see 401 missing_permission → the scope remedy, not "wrong key"
    expect(r.summary).toMatch(/MISSING A PERMISSION SCOPE/i);
  });

  it("flags EXHAUSTED quota when characters used >= limit and STT still works", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_test";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/user/subscription")) {
        return new Response(JSON.stringify({ character_count: 100000, character_limit: 100000 }), { status: 200 });
      }
      // realtime token mint succeeds (scope fine) — so the FAILING check is quota
      return new Response(JSON.stringify({ token: "t" }), { status: 200 });
    });
    const r = await probeElevenLabsVoice();
    expect(r.ok).toBe(false);
    expect(r.summary).toMatch(/EXHAUSTED/i);
  });

  it("reports healthy when quota remains and STT scope is present", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_test";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/user/subscription")) {
        return new Response(JSON.stringify({ character_count: 10, character_limit: 100000 }), { status: 200 });
      }
      return new Response(JSON.stringify({ token: "t" }), { status: 200 });
    });
    const r = await probeElevenLabsVoice();
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/healthy/i);
  });

  it("flags a missing TTS scope even when STT + quota are fine (full blast radius)", async () => {
    process.env.ELEVENLABS_API_KEY = "sk_test";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/user/subscription")) {
        return new Response(JSON.stringify({ character_count: 10, character_limit: 100000 }), { status: 200 });
      }
      if (url.includes("/single-use-token")) {
        return new Response(JSON.stringify({ token: "t" }), { status: 200 });
      }
      // text-to-speech synthesis → scope missing (Jeff's voice + cues would stay broken)
      return new Response('{"detail":{"status":"missing_permissions"}}', { status: 401 });
    });
    const r = await probeElevenLabsVoice();
    expect(r.ok).toBe(false); // NOT reported healthy on an STT-only fix
    const tts = r.checks.find((c) => c.name === "tts-scope");
    expect(tts?.ok).toBe(false);
    expect(tts?.detail).toMatch(/Jeff's voice/i);
  });
});
