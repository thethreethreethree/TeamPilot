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

// Per TT.md A21 audit (2026-06-18) MED finding — the env validator
// at src/lib/env.ts now parses ELEVENLABS_API_KEY at startup, so a
// missing key surfaces immediately instead of on first customer call.
// This local getApiKey still .trim()s defensively (the env validator
// allows the empty string to keep voice optional in dev).

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
 * Human-readable CAUSE of an ElevenLabs auth/authorization rejection, for the SERVER LOG.
 *
 * A 401 has two DIFFERENT fixes and must not be conflated: a key that is *missing a
 * permission scope* (fix = enable the scope / regenerate) vs a key that is *wrong or
 * expired* (fix = replace it). ElevenLabs signals the former with `"missing_permissions"`
 * in the response body. Distinguishing them stops the log from sending the operator to
 * the wrong fix — which is exactly what bit us 2026-08-07: the prod key was a freshly
 * created SCOPED key without the Speech-to-Text / realtime permission, but the log said
 * "present but INVALID — replace it", pointing at the wrong remedy. Verified live that a
 * scoped key returns `missing_permissions` (401) for an op it lacks.
 */
export function describeElevenLabsAuthError(status: number, body: string): string {
  const b = (body || "").toLowerCase();
  if (status === 401 && b.includes("missing_permission")) {
    return (
      `the key is present but MISSING A PERMISSION SCOPE (not a wrong key). Enable ` +
      `"Speech to Text" + the realtime/Scribe permission on this key in elevenlabs.io → ` +
      `API Keys (or regenerate WITH those scopes), then update Vercel + redeploy.`
    );
  }
  if (status === 401) {
    return (
      `the key is present but INVALID — a wrong/expired key or a stray character ` +
      `(whitespace is auto-trimmed). Re-check the Vercel value against elevenlabs.io → API Keys.`
    );
  }
  if (status === 402 || status === 403) {
    return `likely a quota/billing/plan limit on the account (${status}). Check elevenlabs.io usage/billing.`;
  }
  // The value in ELEVENLABS_API_KEY is the key's ID, not the usable key. ElevenLabs returns this
  // (typically 400/401 authentication_error) when someone copies the key ID shown in the dashboard
  // instead of the actual key value (shown only once at creation). Observed live 2026-08-09.
  if (b.includes("api_key_id_used_as_api_key") || b.includes("api_key_id used as api_key")) {
    return (
      `the value set for the key is a key ID, NOT the usable key. The long hex string listed next ` +
      `to a key in elevenlabs.io is its ID; the real key is shown only once at creation. Regenerate ` +
      `the key, copy the value it shows you, and put THAT in ELEVENLABS_API_KEY (then redeploy).`
    );
  }
  return `HTTP ${status}.`;
}

/**
 * probeElevenLabsVoice — a live, read-only health probe for the voice provider, so an operator can
 * get the EXACT cause of a "live coaching won't start / recording won't process" outage in one call
 * instead of digging Vercel logs. Both of those surfaces auth against ElevenLabs STT, so a single
 * provider problem breaks both — this probe pins which one:
 *   - key not set        → set ELEVENLABS_API_KEY in the deploy env + redeploy
 *   - account 401        → wrong/expired key (or scope) — see the detail string
 *   - quota exhausted    → top up credits / upgrade the plan (the "worked yesterday, dead today" cause)
 *   - STT scope missing  → 401 missing_permission — enable "Speech to Text" + realtime/Scribe on the key
 *   - network/outage     → transient; check status.elevenlabs.io
 * Read-only: it lists the subscription and mints a single-use token (the exact live-coaching op); it
 * neither transcribes nor synthesizes, so it costs no characters.
 */
export async function probeElevenLabsVoice(): Promise<{
  ok: boolean;
  summary: string;
  checks: { name: string; ok: boolean; detail: string }[];
}> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  if (!key) {
    return {
      ok: false,
      summary: "ELEVENLABS_API_KEY is NOT set in this environment — set it in the deploy env (Vercel) and redeploy.",
      checks: [{ name: "api-key-present", ok: false, detail: "process.env.ELEVENLABS_API_KEY is empty." }],
    };
  }
  checks.push({ name: "api-key-present", ok: true, detail: "Key is set." });

  // Format guard (the trap behind the 2026-08-09 outage): a real ElevenLabs key starts with "sk_".
  // The 64-char hex shown next to a key in the dashboard is its ID — pasting THAT into ELEVENLABS_API_KEY
  // is the #1 mistake, and it fails EVERY op with "api_key_id_used_as_api_key". Catch it up front so the
  // verdict names it before spending three API round-trips.
  if (!key.startsWith("sk_")) {
    checks.push({
      name: "key-format",
      ok: false,
      detail:
        `the value does NOT start with "sk_" — it looks like a key ID (the hex shown next to the key in ` +
        `elevenlabs.io), not the usable key. The real key starts with "sk_" and is shown once at creation. ` +
        `Replace ELEVENLABS_API_KEY with the "sk_…" value and redeploy.`,
    });
  }

  // 1) Account + quota (also catches a wrong/expired key via 401).
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      // Route EVERY non-2xx through the classifier — it recognizes the key-ID case (a 400) and the 4xx
      // auth cases and returns the plain remedy; only if it can't classify do we fall back to the raw body
      // (which would otherwise truncate the useful part, as observed live 2026-08-09).
      const described = describeElevenLabsAuthError(res.status, body);
      checks.push({
        name: "account",
        ok: false,
        detail: described === `HTTP ${res.status}.` ? `HTTP ${res.status}: ${body.slice(0, 200)}` : described,
      });
    } else {
      let used: number | null = null;
      let limit: number | null = null;
      try {
        const j = JSON.parse(body) as { character_count?: number; character_limit?: number };
        used = j.character_count ?? null;
        limit = j.character_limit ?? null;
      } catch {
        /* quota fields unavailable */
      }
      const remaining = used !== null && limit !== null ? limit - used : null;
      const exhausted = remaining !== null && remaining <= 0;
      checks.push({
        name: "quota",
        ok: !exhausted,
        detail:
          limit !== null
            ? `characters ${used}/${limit} used${remaining !== null ? `, ${remaining} remaining` : ""}${exhausted ? " — EXHAUSTED: top up credits or upgrade the plan." : "."}`
            : "subscription reachable (quota fields unavailable).",
      });
    }
  } catch (e) {
    checks.push({
      name: "account",
      ok: false,
      detail: `couldn't reach ElevenLabs (network/outage): ${e instanceof Error ? e.message : "unknown"}`,
    });
  }

  // 2) Realtime STT token — the EXACT op live coaching + transcription auth needs; pins a missing STT scope.
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST",
      headers: { "xi-api-key": key, Accept: "application/json" },
    });
    if (res.ok) {
      checks.push({ name: "stt-scope", ok: true, detail: "realtime STT token minted — Speech-to-Text scope is present." });
    } else {
      const body = await res.text().catch(() => "");
      checks.push({
        name: "stt-scope",
        ok: false,
        detail: `${describeElevenLabsAuthError(res.status, body)} (raw ${res.status})`,
      });
    }
  } catch (e) {
    checks.push({
      name: "stt-scope",
      ok: false,
      detail: `couldn't reach ElevenLabs: ${e instanceof Error ? e.message : "unknown"}`,
    });
  }

  // 3) Text-to-Speech scope — Jeff's voice + coach cues need it, and it drops on key rotation JUST like
  // STT. A 1-character synthesis is the cheapest definitive test (~1 char, negligible). Without this check
  // the probe could report "healthy" on an STT-only fix while Jeff's voice + cues stayed broken.
  try {
    const res = await fetch(`${TTS_ENDPOINT}/${getDefaultVoiceId()}/stream`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: ".",
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (res.ok) {
      try {
        await res.body?.cancel();
      } catch {
        /* discard the audio without reading it */
      }
      checks.push({ name: "tts-scope", ok: true, detail: "1-char synthesis succeeded — Text-to-Speech scope is present." });
    } else {
      const body = await res.text().catch(() => "");
      checks.push({
        name: "tts-scope",
        ok: false,
        detail: `${describeElevenLabsAuthError(res.status, body)} (raw ${res.status}) — affects Jeff's voice + coach cues.`,
      });
    }
  } catch (e) {
    checks.push({
      name: "tts-scope",
      ok: false,
      detail: `couldn't reach ElevenLabs: ${e instanceof Error ? e.message : "unknown"}`,
    });
  }

  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    summary:
      failed.length === 0
        ? "ElevenLabs voice is healthy: key set, quota available, Speech-to-Text scope present."
        : `Voice is FAILING — ${failed.map((c) => `[${c.name}] ${c.detail}`).join("  |  ")}`,
    checks,
  };
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
/**
 * Maximum characters per single TTS call. Per TT.md A21 audit
 * (2026-06-18) HIGH finding — until this cap, an unbounded
 * reply_signature appended to an LLM-generated body could result
 * in a multi-KB synthesis request, blowing up cost (ElevenLabs
 * bills per character). 800 chars ≈ 5-6 sentences ≈ ~20s of
 * synthesized speech — well above the ~80-token reply ceiling
 * but bounded against accidents and abuse.
 */
const TTS_MAX_CHARS = 800;

export async function synthesizeSpeechStream(args: {
  text: string;
  voiceId?: string | null;
}): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getApiKey();
  const voiceId = args.voiceId ?? getDefaultVoiceId();

  // Hard cost guardrail BEFORE the request goes to ElevenLabs.
  // If the text exceeds the ceiling, truncate at the nearest
  // sentence break before the cap so playback doesn't end mid-
  // word. The agent gets the truncation feedback (debug log)
  // so they can investigate the upstream cause.
  let text = args.text;
  if (text.length > TTS_MAX_CHARS) {
    const head = text.slice(0, TTS_MAX_CHARS);
    const lastBreak = Math.max(
      head.lastIndexOf(". "),
      head.lastIndexOf("? "),
      head.lastIndexOf("! ")
    );
    text =
      lastBreak > TTS_MAX_CHARS * 0.5
        ? text.slice(0, lastBreak + 1)
        : head;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[care/voice] TTS truncated from ${args.text.length} → ${text.length} chars (cap ${TTS_MAX_CHARS}).`
      );
    }
  }

  const response = await fetch(`${TTS_ENDPOINT}/${voiceId}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
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
    // 401/402/403 → the accurate remedy (scope-missing vs wrong-key vs quota). This is the TTS path
    // (Jeff's voice + coach cues) — the one that 401s if the key lacks the Text-to-Speech scope, so it
    // must NOT hardcode "invalid key". Shared with the STT/mint sites via describeElevenLabsAuthError.
    if (typeof console !== "undefined" && response.status >= 401 && response.status <= 403) {
      console.error(
        `[care/voice] ElevenLabs rejected TTS (${response.status}): ` +
          `${describeElevenLabsAuthError(response.status, err)} Provider: ${err.slice(0, 200)}`
      );
    }
    if (response.status === 401) {
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
    // 401/402/403 → the accurate remedy (scope-missing vs wrong-key vs quota) via the shared helper,
    // instead of hardcoding "invalid key" (which misdiagnoses a scoped key lacking Speech-to-Text).
    if (typeof console !== "undefined" && response.status >= 401 && response.status <= 403) {
      console.error(
        `[care/voice] ElevenLabs rejected STT (${response.status}): ` +
          `${describeElevenLabsAuthError(response.status, err)} Provider: ${err.slice(0, 200)}`
      );
    }
    if (response.status === 401) {
      throw new Error("Voice isn't available right now.");
    }
    throw new Error(
      `ElevenLabs STT failed: ${response.status} ${err.slice(0, 300)}`
    );
  }
  const result = (await response.json()) as { text?: string };
  return (result.text ?? "").trim();
}

export type DiarizedSegment = { speakerId: string; text: string; start: number };

/**
 * Batch speech-to-text WITH speaker diarization (Live Sales Coach S1a).
 * Same Scribe endpoint as transcribeSpeech, plus diarize=true + an
 * optional speaker-count hint. Returns segments grouped by speaker
 * (speaker_0 / speaker_1 / …) — the caller maps those to agent/customer
 * after the agent's one-tap.
 *
 * Response shape verified against the ElevenLabs convert docs
 * (2026-06-27): words[] each carry text + speaker_id + start + type.
 * VERIFIED against the live API 2026-08-06: POST /v1/speech-to-text scribe_v1 diarize → HTTP 200 + a valid
 * transcription response (silent-audio probe). A prod "Transcription failed" is env/account, not this code.
 */
export async function transcribeWithDiarization(args: {
  audio: Buffer;
  mimeType: string;
  numSpeakers?: number;
}): Promise<DiarizedSegment[]> {
  const apiKey = getApiKey();
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(args.audio)], { type: args.mimeType }),
    "audio"
  );
  form.append("model_id", "scribe_v1");
  form.append("diarize", "true");
  if (args.numSpeakers && args.numSpeakers > 1) {
    form.append("num_speakers", String(args.numSpeakers));
  }

  const response = await fetch(STT_ENDPOINT, {
    method: "POST",
    headers: { "xi-api-key": apiKey, Accept: "application/json" },
    body: form,
  });
  if (!response.ok) {
    const err = await response.text().catch(() => "");
    // Same diagnostic as the token mint + TTS — surface the 401/402/403 cause in the log so "Transcription
    // failed" is debuggable at a glance (both share the ELEVENLABS_API_KEY / account).
    if (typeof console !== "undefined" && response.status >= 401 && response.status <= 403) {
      console.error(
        `[care/voice] ElevenLabs rejected diarized STT (${response.status}): ` +
          `${describeElevenLabsAuthError(response.status, err)} Provider: ${err.slice(0, 200)}`
      );
    }
    throw new Error(
      `ElevenLabs diarized STT failed: ${response.status} ${err.slice(0, 300)}`
    );
  }

  const result = (await response.json()) as {
    words?: Array<{
      text?: string;
      speaker_id?: string;
      start?: number;
      type?: string;
    }>;
  };
  const words = result.words ?? [];

  // Group consecutive words by speaker into readable segments. Skip
  // non-word tokens (spacing / audio_event).
  const segments: DiarizedSegment[] = [];
  for (const w of words) {
    if (w.type && w.type !== "word") continue;
    const text = (w.text ?? "").trim();
    if (!text) continue;
    const speakerId = w.speaker_id ?? "speaker_0";
    const last = segments[segments.length - 1];
    if (last && last.speakerId === speakerId) {
      last.text += " " + text;
    } else {
      segments.push({ speakerId, text, start: w.start ?? 0 });
    }
  }
  return segments;
}

/**
 * Mint a single-use token for browser-direct Scribe v2 Realtime
 * (Live Sales Coach S1b). The browser opens the realtime websocket with
 * ?token=… so the API key never leaves the server. Token is time-bound
 * (~15 min) and consumed on use.
 *
 * Endpoint verified against the ElevenLabs docs (2026-06-27):
 * POST /v1/single-use-token/realtime_scribe with the xi-api-key header.
 * VERIFIED against the live API 2026-08-06: POST /v1/single-use-token/realtime_scribe with the trimmed
 * xi-api-key returns HTTP 200 + a single-use `token`. So a prod "Token mint failed" is NOT this code — it is
 * the deployed environment: ELEVENLABS_API_KEY missing OR present-but-not-yet-live (a Vercel env-var change
 * needs a REDEPLOY to take effect) OR a key/account problem (401 wrong key, 402/403 quota/plan). Read the
 * "[realtime-token] mint failed:" server log line for which.
 */
export async function mintRealtimeSttToken(): Promise<string> {
  const apiKey = getApiKey();
  const response = await fetch(
    "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
    }
  );
  if (!response.ok) {
    const err = await response.text().catch(() => "");
    // Make the cause obvious in the server log (matches synthesizeSpeechStream's 401 diagnostic) so an
    // operator debugging "Token mint failed" reads the reason, not a raw status.
    if (typeof console !== "undefined" && response.status >= 401 && response.status <= 403) {
      console.error(
        `[care/voice] ElevenLabs rejected realtime-token (${response.status}): ` +
          `${describeElevenLabsAuthError(response.status, err)} Provider: ${err.slice(0, 200)}`
      );
    }
    throw new Error(
      `ElevenLabs token mint failed: ${response.status} ${err.slice(0, 300)}`
    );
  }
  const result = (await response.json()) as { token?: string };
  if (!result.token) {
    throw new Error("ElevenLabs token mint returned no token.");
  }
  return result.token;
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
