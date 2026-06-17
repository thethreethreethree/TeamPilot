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
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error(
      "Voice not configured (ELEVENLABS_API_KEY env var missing)."
    );
  }
  return key;
}

function getDefaultVoiceId(): string {
  return process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? DEFAULT_VOICE_ID;
}

/**
 * Synthesize Jeff's text reply into audio (mp3 bytes).
 *
 * Caller picks the voice via voiceId override; falls back to
 * the deployment-level default if none provided. Per §A4 the
 * per-tenant voice picker UI surfaces voiceId from the tenant
 * config (Phase 9 commit 2).
 *
 * Returns the raw audio buffer so the API route can stream
 * straight to the client without round-tripping through a
 * temporary file.
 */
export async function synthesizeSpeech(args: {
  text: string;
  voiceId?: string | null;
}): Promise<Buffer> {
  const apiKey = getApiKey();
  const voiceId = args.voiceId ?? getDefaultVoiceId();

  const response = await fetch(`${TTS_ENDPOINT}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: args.text,
      // eleven_turbo_v2_5 is the lowest-latency model for English
      // conversational use cases per ElevenLabs' own guidance.
      // Worth revisiting per §A4 once we have voice usage data.
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS failed: ${response.status} ${err.slice(0, 300)}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
    throw new Error(
      `ElevenLabs STT failed: ${response.status} ${err.slice(0, 300)}`
    );
  }
  const result = (await response.json()) as { text?: string };
  return (result.text ?? "").trim();
}

export { DEFAULT_VOICE_ID };
