/**
 * The prospect's side of a remote live call (founder 2026-11-22: "the audio needs to be recorded and monitored for
 * both the agent and the prospect").
 *
 * WHY THIS EXISTS. On a phone or video call the device mic hears the rep only; the prospect's voice comes out of
 * the call (a Meet/Zoom/Teams tab, a browser softphone). Before this, a live remote call recorded and transcribed one
 * side. The browser can hand a page another tab's audio only through screen-share (`getDisplayMedia`) with "Share
 * tab audio" ticked, so that is the one route: the rep shares the call's tab, and
 *
 *   1. RECORD — the tab audio is mixed with the mic into the call recording (useLiveCoaching builds the mix), so
 *      the saved audio holds both voices and the after-call pipeline can diarize it;
 *   2. MONITOR — the tab audio is transcribed on its OWN realtime socket (CallAudioTranscriber below). Every line it
 *      produces is the prospect BY SOURCE — it never went through the mic — so it is labelled "customer" with
 *      source "call-audio" (0302), not guessed from loudness or content.
 *
 * The mic socket is untouched: it stays the rep's side. The two are independent, so a dropped prospect socket never
 * stops the rep's transcript or the recording, and vice versa.
 *
 * Honest limits (§3.4): the browser must support tab-audio share (desktop Chrome/Edge; not Safari, not phones);
 * a call running in a desktop app (not a tab) has no tab to share — on Windows Chrome the "Entire screen" option can
 * share system audio instead. Every one of those cases is named to the rep (callAudioNote), never silent.
 */

export type CallAudioState =
  | "off" // not requested (in-person, or the rep chose mic only)
  | "unsupported" // this browser can't share another tab's audio
  | "declined" // the rep cancelled the share picker
  | "not_shared" // a share was granted without audio ("Share tab audio" left unticked)
  | "connecting"
  | "live"
  | "lost"; // the share ended or the prospect socket could not reconnect

/** Whether this browser can share another tab's audio at all (desktop Chromium; never iOS/Android). */
export function callAudioSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof (navigator.mediaDevices as { getDisplayMedia?: unknown }).getDisplayMedia === "function"
  );
}

/**
 * Ask the rep to share the call's tab WITH its audio. Must be the FIRST await after the Start click — browsers only
 * allow the share picker during the click's user activation, so it runs before the mic prompt.
 * Returns the stream when an audio track came with it; otherwise the honest reason there is none.
 */
export async function requestCallAudio(): Promise<
  { ok: true; stream: MediaStream } | { ok: false; state: "unsupported" | "declined" | "not_shared" }
> {
  if (!callAudioSupported()) return { ok: false, state: "unsupported" };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      // Chrome requires video to offer the tab picker; the frames are never used (the track is disabled below).
      video: true,
      // Raw call audio: echo cancellation / noise suppression would treat the prospect's voice as noise to remove.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      // Chromium hints: offer tabs first, never this page itself (sharing our own tab would capture the coach's
      // cues, not the prospect), and allow system audio where the OS supports it (Windows "Entire screen").
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      systemAudio: "include",
      surfaceSwitching: "include",
    } as DisplayMediaStreamOptions);
  } catch {
    return { ok: false, state: "declined" };
  }
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    return { ok: false, state: "not_shared" };
  }
  // Keep the video track (stopping it can end the whole share in some Chromium builds) but stop it doing work.
  stream.getVideoTracks().forEach((t) => {
    t.enabled = false;
  });
  return { ok: true, stream };
}

/** What the rep is told about the prospect's side. Null when there is nothing to say (in-person / off). */
export function callAudioNote(state: CallAudioState): { tone: "ok" | "warn"; text: string } | null {
  switch (state) {
    case "off":
      return null;
    case "connecting":
      return { tone: "ok", text: "Connecting the prospect's side…" };
    case "live":
      return { tone: "ok", text: "Recording and transcribing both sides — you from your mic, the prospect from the call's audio." };
    case "unsupported":
      return {
        tone: "warn",
        text: "This browser can't share the call's audio, so only your side is being recorded. Use desktop Chrome or Edge to capture the prospect too, or upload the call's recording afterwards.",
      };
    case "declined":
      return {
        tone: "warn",
        text: "The call's audio wasn't shared, so only your side is being recorded. Stop and start again, then pick the call's tab to capture the prospect.",
      };
    case "not_shared":
      return {
        tone: "warn",
        text: "The tab was shared without its audio, so only your side is being recorded. Stop and start again, pick the call's tab and tick \"Share tab audio\".",
      };
    case "lost":
      return {
        tone: "warn",
        text: "The prospect's side stopped (the share ended or the connection dropped). Your side is still recording. Stop and start again to capture both.",
      };
  }
}

/** 16-bit little-endian PCM, base64 — the realtime socket's input_audio_chunk payload. Shared by both sockets. */
export function floatTo16BitPCMBase64(input: Float32Array): string {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

/** A committed line from the call's audio: the prospect, final (no /attribute refine), timed on the browser clock. */
export function prospectTurn(text: string, startedAtMs: number | null, now: number = Date.now()) {
  return {
    text,
    speaker: "customer" as const,
    pending: false,
    source: "call-audio" as const,
    spokenAt: new Date(startedAtMs ?? now).toISOString(),
  };
}

const MAX_RECONNECTS = 3;

/**
 * The prospect's realtime socket: the shared tab's audio → its own AudioContext → its own Scribe socket. Self-
 * contained so the mic pipeline (and its reconnect ladder) is untouched. Bounded reconnect on a mid-call drop; a
 * share that ends (the rep clicked "Stop sharing") is final and reported as "lost".
 */
export class CallAudioTranscriber {
  private ctx: AudioContext | null = null;
  private proc: ScriptProcessorNode | null = null;
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempts = 0;
  private utteranceStart: number | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly opts: {
      track: MediaStreamTrack;
      wsUrl: (token: string, sampleRate: number) => string;
      getToken: () => Promise<string>;
      onState: (s: "connecting" | "live" | "lost") => void;
      onPartial: (text: string) => void;
      onCommit: (text: string, startedAtMs: number | null) => void;
      onTimestamps: (text: string, words: unknown) => void;
    },
  ) {
    opts.track.addEventListener("ended", () => {
      if (this.stopped) return;
      this.stop();
      opts.onState("lost");
    });
  }

  async start(): Promise<void> {
    if (this.stopped) return;
    this.opts.onState("connecting");
    let token: string;
    try {
      token = await this.opts.getToken();
    } catch {
      this.retryOrLose();
      return;
    }
    if (this.stopped) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ sampleRate: 16000 });
    } catch {
      ctx = new AudioContext();
    }
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    if (this.stopped) {
      this.freeGraph();
      return;
    }
    const sr = Math.round(ctx.sampleRate);
    const ws = new WebSocket(this.opts.wsUrl(token, sr));
    this.ws = ws;
    const source = ctx.createMediaStreamSource(new MediaStream([this.opts.track]));
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    this.proc = proc;
    source.connect(proc);
    // Keep the processor alive through a muted gain — never play the prospect back into the rep's speakers.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    proc.connect(mute);
    mute.connect(ctx.destination);
    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: floatTo16BitPCMBase64(e.inputBuffer.getChannelData(0)),
            sample_rate: sr,
          }),
        );
      } catch {
        /* a dropped frame; onclose handles a dead socket */
      }
    };
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.opts.onState("live");
      // Refill the reconnect budget only once the socket proves STABLE — resetting on every open let a socket that
      // opens and drops loop forever, minting a token each time (the mic socket learned this on 2026-08-21).
      if (this.stableTimer) clearTimeout(this.stableTimer);
      this.stableTimer = setTimeout(() => {
        this.attempts = 0;
      }, 15_000);
    };
    ws.onclose = () => {
      if (this.stopped) return;
      this.freeGraph();
      if (!opened && this.attempts >= MAX_RECONNECTS) {
        this.opts.onState("lost");
        return;
      }
      this.retryOrLose();
    };
    ws.onmessage = (ev) => {
      let msg: { message_type?: string; text?: string; words?: unknown };
      try {
        msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        return;
      }
      if (msg.message_type === "partial_transcript") {
        const t = (msg.text ?? "").trim();
        if (t && this.utteranceStart === null) this.utteranceStart = Date.now();
        this.opts.onPartial(msg.text ?? "");
      } else if (msg.message_type === "committed_transcript") {
        const t = (msg.text ?? "").trim();
        const startedAt = this.utteranceStart;
        this.utteranceStart = null;
        this.opts.onPartial("");
        if (t) this.opts.onCommit(t, startedAt);
      } else if (msg.message_type === "committed_transcript_with_timestamps") {
        this.opts.onTimestamps((msg.text ?? "").trim(), msg.words);
      }
    };
  }

  stop(): void {
    this.stopped = true;
    this.freeGraph();
  }

  private retryOrLose(): void {
    if (this.stopped) return;
    if (this.opts.track.readyState !== "live" || this.attempts >= MAX_RECONNECTS) {
      this.opts.onState("lost");
      return;
    }
    this.attempts += 1;
    this.opts.onState("connecting");
    setTimeout(() => void this.start(), 500 * this.attempts);
  }

  private freeGraph(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* noop */
      }
    }
    try {
      this.proc?.disconnect();
    } catch {
      /* noop */
    }
    this.proc = null;
    try {
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
  }
}
