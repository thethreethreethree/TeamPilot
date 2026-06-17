import "server-only";

/**
 * ElevenLabs voice integration — Phase 9 commit 1.
 *
 * Two server-side helpers:
 *   - synthesizeSpeech(text, voiceId?) — Jeff's text → audio
 *     (mp3 bytes). Used by /api/care/tts.
 *   - transcribeSpeech(audio) — customer audio → text. Used
 *     by /api/care/stt.
 *
 * Constitutional sources (consulted per §0.1):
 *   - §A4 — provider choice is one ElevenLabs decision; voice
 *     pick is a per-tenant uncertainty surfaced via voice_id
 *     column (migration 0043). The helpers stay narrow so
 *     swapping STT to Whisper (or any other provider) later
 *     is a one-file change.
 *   - §A16 — these helpers don't touch the conversation chain
 *     or Coach. They convert between text and audio at the
 *     edges of the existing /messages pipeline. Composition is
 *     preserved.
 *   - §A14 — both functions throw on provider failure rather
 *     than returning a silent empty response. The caller
 *     surfaces the error to the UI per §A14 multi-state
 *     verification.
 *   - §A12 — env-var dependencies fail-fast at call-site, not
 *     at module-load, so deployment without voice configured
 *     doesn't break unrelated paths.
 */

const TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const STT_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

// Antoni — well-rounded conversational male. Default per §A4
// until the per-tenant picker UI ships. User said "default to
// one, will choose voice later." This is the one.
const DEFAULT_VOICE_ID = "ErXwobaYiN019PkySvjV";

function getApiKey(): string {
  // .trim() — defensive against the most common deploy mistake:
  // pasting the key with a trailing newline or surrounding
  // whitespace into the Vercel env var UI. ElevenLabs returns
  // 401 invalid_api_key for any whitespace difference, which
  // looks indistinguishable from a "wrong key" to the operator.
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    if (typeof console !== "undefined") {
      console.error(
        "[care/voice] ELEVENLABS_API_KEY env var is missing. " +
          "Set it in Vercel project settings (Production + Preview) to enable Jeff's voice."
      );
    }
    throw new Error("Voice isn't available right now.");
  }
  return key;
}

function getDefaultVoiceId(): string {
  return process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? DEFAULT_VOICE_ID;
}

/**
 * Synthesize Jeff's text reply into a STREAMING audio response.
 *
 * 2026-06-17 — switched from buffered synthesizeSpeech (returned
 * full Buffer) to the streaming variant. ElevenLabs' /stream
 * endpoint starts sending mp3 bytes the moment the first
 * syllable is synthesized (~75ms with flash model) instead of
 * waiting for the full reply (~500-1500ms). Combined with the
 * client-side MediaSource decoder, customers hear Jeff start
 * talking before his whole reply has been generated.
 *
 * Returns the raw ReadableStream of mp3 chunks. The API route
 * pipes this directly to the client as a chunked response —
 * no server-side buffering.
 */
export async function synthesizeSpeechStream(args: {
  text: string;
  voiceId?: string | null;
}): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getApiKey();
  const voiceId = args.voiceId ?? getDefaultVoiceId();

  const response = await fetch(`${TTS_ENDPOINT}/${voiceId}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: args.text,
      // 2026-06-17 — switched turbo_v2_5 → flash_v2_5 after user
      // reported Jeff feels slow. Flash is ElevenLabs' ultra-low-
      // latency model (~75ms first-byte vs turbo's ~250-400ms).
      // Quality drop is barely perceptible for conversational
      // support use; latency win is large.
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    if (response.status === 401) {
      if (typeof console !== "undefined") {
        console.error(
          "[care/voice] ElevenLabs rejected TTS auth (401). " +
            "ELEVENLABS_API_KEY is set but invalid. Check: " +
            "no whitespace, no surrounding quotes, key is active " +
            "in elevenlabs.io → Profile → API Keys. Provider response: " +
            err.slice(0, 300)
        );
      }
      throw new Error("Voice isn't available right now.");
    }
    throw new Error(
      `ElevenLabs TTS failed: ${response.status} ${err.slice(0, 300)}`
    );
  }
  if (!response.body) {
    throw new Error("ElevenLabs TTS returned no response body.");
  }
  return response.body;
}

/**
 * Transcribe customer audio into text via ElevenLabs Scribe.
 *
 * Accepts a Blob / Buffer / Uint8Array — the route handler
 * normalizes whatever the browser sent (typically a webm or
 * wav blob from MediaRecorder).
 *
 * Returns the transcript string. The caller pushes it through
 * the existing /api/care/conversations/[id]/messages endpoint
 * so the §3.1 event chain stays intact and Jeff's brain runs
 * unchanged.
 */
export async function transcribeSpeech(args: {
  audio: Buffer;
  /** Mime type the browser sent — passed verbatim to provider. */
  mimeType: string;
}): Promise<string> {
  const apiKey = getApiKey();

  // ElevenLabs Scribe expects multipart/form-data with the
  // audio file under "file". Build it server-side.
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(args.audio)], { type: args.mimeType }),
    "audio"
  );
  form.append("model_id", "scribe_v1");

  const response = await fetch(STT_ENDPOINT, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      Accept: "application/json",
    },
    body: form,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    if (response.status === 401) {
      if (typeof console !== "undefined") {
        console.error(
          "[care/voice] ElevenLabs rejected STT auth (401). " +
            "ELEVENLABS_API_KEY is set but invalid. Check: " +
            "no whitespace, no surrounding quotes, key is active " +
            "in elevenlabs.io → Profile → API Keys. Provider response: " +
            err.slice(0, 300)
        );
      }
      throw new Error("Voice isn't available right now.");
    }
    throw new Error(
      `ElevenLabs STT failed: ${response.status} ${err.slice(0, 300)}`
    );
  }
  const result = (await response.json()) as { text?: string };
  return (result.text ?? "").trim();
}

export { DEFAULT_VOICE_ID };

/**
 * Curated voice options for the tenant picker. Five ElevenLabs
 * pre-made voices covering different shapes a support agent
 * persona might want. Per §A4 the picker is intentionally small
 * — the full library is hundreds of voices and would overwhelm
 * the settings page. Tenants who want a different voice can
 * request it; the field is freeform text in care_tenant_config
 * so any valid voice ID works even if it's not in this list.
 */
export type CuratedVoice = {
  id: string;
  name: string;
  description: string;
};

export const CURATED_VOICES: CuratedVoice[] = [
  {
    id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    description: "Well-rounded conversational male · default",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    description: "Deep authoritative male",
  },
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    description: "Calm professional female",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    description: "Soft friendly female",
  },
  {
    id: "yoZ06aMxZJJ28mfd3POQ",
    name: "Sam",
    description: "Warm narrative male",
  },
];
