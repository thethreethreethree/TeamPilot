"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MessageCircle, Send, Volume2, X } from "lucide-react";

/**
 * Embedded C.A.R.E widget — runs inside the iframe served at
 * /widget/care/[embedToken]. Different from the dashboard-side
 * CareChatWidget in two ways:
 *
 *   1. Loads tenant config (color, greeting, position) from
 *      /api/care/widget/bootstrap on mount. Falls back to ELOSTATE
 *      defaults if bootstrap fails so the visitor isn't left
 *      with a broken white square.
 *
 *   2. Communicates with the host page via postMessage so the
 *      host can resize the iframe when the widget expands or
 *      collapses. Without this, the iframe stays 60x60 forever
 *      and the chat panel is invisible.
 *
 * The embed token is captured at SSR time so we can pass it on
 * every API call without trusting URL parsing on the client.
 */

const STORAGE_KEY_BASE = "care-widget-session";

type WidgetConfig = {
  color: string;
  greeting: string;
  subtitle: string;
  position: "bottom-right" | "bottom-left";
  logoUrl: string | null;
  displayName: string | null;
};

type StoredSession = {
  conversationId: string;
  sessionToken: string;
};

type Message = {
  id: string;
  authorType: "customer" | "ai" | "agent" | "system";
  body: string;
  createdAt: string;
};

const DEFAULT_CONFIG: WidgetConfig = {
  color: "#FACC15",
  greeting: "We're here to help",
  subtitle: "Typical reply: a few seconds",
  position: "bottom-right",
  logoUrl: null,
  displayName: null,
};

export function CareEmbeddedWidget({ embedToken }: { embedToken: string }) {
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // ─── Phase 9 voice mode state ──────────────────────────────
  // §A14 explicit states. The widget can be in EITHER text mode
  // (the original surface) or voice mode (the real-time loop).
  // Customer opt-in: clicking "Talk to Jeff" enters voice mode;
  // clicking the close-voice control returns to text.
  type VoicePhase =
    | "idle" // voice mode active, awaiting customer to press the mic
    | "recording" // customer holding the mic button
    | "transcribing" // audio uploaded, STT in flight
    | "thinking" // transcript sent to /messages, awaiting Jeff
    | "speaking" // Jeff's reply received, TTS audio playing
    | "error";
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const storageKey = `${STORAGE_KEY_BASE}:${embedToken}`;

  // Tell the host page to resize the iframe when our open state
  // changes. Host script listens for these messages and adjusts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.parent?.postMessage(
      { type: "care:widget:size", open },
      "*"
    );
  }, [open]);

  // Bootstrap config from the server.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/care/widget/bootstrap?token=${encodeURIComponent(embedToken)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.widget) {
            setConfig({ ...DEFAULT_CONFIG, ...data.widget });
          }
        } else {
          const data = await res.json().catch(() => ({}));
          setBootstrapError(
            data.reason === "origin_rejected"
              ? "This domain isn't authorized for this widget."
              : data.reason === "tenant_unknown"
                ? "Widget config not found."
                : "Couldn't load the widget."
          );
        }
      } catch {
        setBootstrapError("Couldn't reach the server.");
      } finally {
        setBootstrapped(true);
      }
    })();
  }, [embedToken]);

  // Restore session from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession;
        if (parsed.conversationId && parsed.sessionToken) {
          setSession(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, aiThinking]);

  const loadMessages = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(
        `/api/care/conversations/${session.conversationId}/messages`,
        { headers: { "x-care-session": session.sessionToken } }
      );
      if (!res.ok) {
        if (res.status === 404 || res.status === 410) {
          window.localStorage.removeItem(storageKey);
          setSession(null);
          setMessages([]);
        }
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      /* ignore */
    }
  }, [session, storageKey]);

  useEffect(() => {
    if (open && session) void loadMessages();
  }, [open, session, loadMessages]);

  // Polling — until S7 wires Supabase realtime, this is what makes
  // an agent reply land in the customer's open widget without a
  // refresh. 4s while the panel is open and the customer isn't
  // mid-send. Pauses when the tab is hidden. loadMessages already
  // handles 404/410 (deleted-server-side) by clearing local state.
  const sendingRef = useRef(false);
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);
  useEffect(() => {
    if (!open || !session) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (sendingRef.current) return;
      void loadMessages();
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [open, session, loadMessages]);

  const ensureSession = useCallback(async (): Promise<StoredSession | null> => {
    if (session) return session;
    try {
      const res = await fetch("/api/care/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedToken }),
      });
      if (!res.ok) {
        setError("Couldn't start a conversation.");
        return null;
      }
      const data = (await res.json()) as StoredSession;
      window.localStorage.setItem(storageKey, JSON.stringify(data));
      setSession(data);
      return data;
    } catch {
      setError("Couldn't reach the server.");
      return null;
    }
  }, [session, embedToken, storageKey]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setError(null);
    const active = await ensureSession();
    if (!active) return;
    setDraft("");
    setSending(true);
    setAiThinking(true);
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        authorType: "customer",
        body,
        createdAt: new Date().toISOString(),
      },
    ]);
    try {
      const res = await fetch(
        `/api/care/conversations/${active.conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-care-session": active.sessionToken,
          },
          body: JSON.stringify({ body }),
        }
      );
      if (!res.ok) {
        setError("Couldn't send. Please try again.");
        setMessages((p) => p.filter((m) => m.id !== tempId));
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setError("Couldn't reach the server.");
      setMessages((p) => p.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      setAiThinking(false);
    }
  };

  // ─── Voice mode handlers ───────────────────────────────────

  /**
   * Play Jeff's reply through TTS. Used at the end of the voice
   * loop. Resolves when audio finishes playing OR when the user
   * clicks anywhere (interrupting). Per §A14 explicit states:
   * "speaking" while audio plays, back to "idle" when done.
   */
  const speakReply = useCallback(
    async (text: string, sessionToken: string) => {
      try {
        setVoicePhase("speaking");
        const res = await fetch(`/api/care/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-care-session": sessionToken,
          },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          setError("Couldn't play Jeff's reply. You can still read it above.");
          setVoicePhase("idle");
          return;
        }
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          void audio.play().catch(() => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          });
        });
        currentAudioRef.current = null;
        setVoicePhase("idle");
      } catch {
        setError("Audio playback failed. You can still read above.");
        setVoicePhase("idle");
      }
    },
    []
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  /**
   * Customer pressed the mic button. Request mic permission (one-
   * time per session), start recording. The release handler
   * stops + uploads + transcribes + sends + speaks.
   */
  const startRecording = useCallback(async () => {
    if (voicePhase !== "idle") return;
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Couldn't access your microphone. Check your browser permissions and try again."
      );
      setVoicePhase("error");
      return;
    }

    audioChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Release the mic immediately so the user doesn't see a
      // lingering recording indicator.
      stream.getTracks().forEach((t) => t.stop());

      const active = await ensureSession();
      if (!active) {
        setVoicePhase("idle");
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      if (audioBlob.size === 0) {
        setVoicePhase("idle");
        return;
      }

      setVoicePhase("transcribing");

      // 1. Transcribe via STT.
      let transcript: string;
      try {
        const sttRes = await fetch(`/api/care/stt`, {
          method: "POST",
          headers: {
            "Content-Type": audioBlob.type,
            "x-care-session": active.sessionToken,
          },
          body: audioBlob,
        });
        if (!sttRes.ok) {
          const data = await sttRes.json().catch(() => ({}));
          setError(data.error || "Couldn't transcribe. Try again.");
          setVoicePhase("idle");
          return;
        }
        const data = await sttRes.json();
        transcript = (data.transcript as string) ?? "";
      } catch {
        setError("Couldn't reach the server.");
        setVoicePhase("idle");
        return;
      }

      if (!transcript.trim()) {
        setError("Didn't catch that. Try again.");
        setVoicePhase("idle");
        return;
      }

      setVoiceTranscript(transcript);
      // Optimistic render in the message stream so the customer
      // sees what was heard.
      const tempId = `temp-voice-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          authorType: "customer",
          body: transcript,
          createdAt: new Date().toISOString(),
        },
      ]);

      // 2. Send transcript through the existing /messages
      // endpoint so Jeff's brain runs unchanged per §A16. The
      // medium=voice flag is for the §4 readout.
      setVoicePhase("thinking");
      let aiReplyText = "";
      try {
        const msgRes = await fetch(
          `/api/care/conversations/${active.conversationId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-care-session": active.sessionToken,
            },
            body: JSON.stringify({ body: transcript, medium: "voice" }),
          }
        );
        if (!msgRes.ok) {
          setError("Couldn't send to Jeff. Try again.");
          setMessages((p) => p.filter((m) => m.id !== tempId));
          setVoicePhase("idle");
          return;
        }
        const data = await msgRes.json();
        const updated = (data.messages ?? []) as Message[];
        setMessages(updated);
        // Find Jeff's latest AI reply for TTS playback.
        const lastAi = [...updated]
          .reverse()
          .find((m) => m.authorType === "ai");
        aiReplyText = lastAi?.body ?? "";
      } catch {
        setError("Couldn't reach the server.");
        setMessages((p) => p.filter((m) => m.id !== tempId));
        setVoicePhase("idle");
        return;
      }

      // 3. Play Jeff's reply via TTS. If the AI didn't reply
      // (e.g., agent already claimed and ai_responding=false),
      // we just return to idle — the agent will reply via the
      // dashboard.
      if (!aiReplyText) {
        setVoicePhase("idle");
        return;
      }
      await speakReply(aiReplyText, active.sessionToken);
    };

    recorder.start();
    setVoicePhase("recording");
  }, [ensureSession, speakReply, voicePhase]);

  const exitVoiceMode = () => {
    // Stop any in-flight recording or playback before leaving.
    stopRecording();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setVoiceMode(false);
    setVoicePhase("idle");
    setVoiceTranscript(null);
  };

  if (!bootstrapped) {
    return (
      <div className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-surface flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted" aria-hidden />
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="fixed bottom-4 right-4 w-72 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
        {bootstrapError}
      </div>
    );
  }

  const posClass =
    config.position === "bottom-left" ? "bottom-4 left-4" : "bottom-4 right-4";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          style={{ backgroundColor: config.color }}
          className={`fixed ${posClass} w-14 h-14 rounded-full text-[#09090B] shadow-lg hover:scale-105 transition-transform flex items-center justify-center`}
        >
          <MessageCircle className="w-6 h-6" aria-hidden />
        </button>
      )}

      {open && (
        <div
          className={`fixed ${posClass} w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] bg-base border border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b border-default flex items-center justify-between"
            style={{ backgroundColor: `${config.color}1A` }}
          >
            <div>
              <p className="text-sm font-semibold text-primary">
                {config.greeting}
              </p>
              <p className="text-[11px] text-muted">{config.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted hover:text-primary p-1.5 rounded-lg hover:bg-surface-raised"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>

          {/* Stream */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center px-4 py-8">
                <p className="text-sm font-medium text-primary mb-1">
                  Hi, my name is Jeff.
                </p>
                <p className="text-xs text-secondary leading-relaxed max-w-[260px] mx-auto">
                  Ask anything — a real person sees these too.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <Bubble key={m.id} message={m} accent={config.color} />
            ))}
            {aiThinking && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                Thinking…
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-2 text-[11px] text-red-400 border-t border-red-500/30 bg-red-500/5">
              {error}
            </div>
          )}

          {/* Phase 9 voice — when voiceMode is active, the
              text composer is replaced by the voice surface.
              The surface IS the §A14 multi-state UI: each
              voicePhase renders a distinct affordance. */}
          {voiceMode ? (
            <VoiceSurface
              phase={voicePhase}
              accent={config.color}
              transcript={voiceTranscript}
              onPress={() => void startRecording()}
              onRelease={stopRecording}
              onExit={exitVoiceMode}
            />
          ) : (
            <div className="border-t border-default p-3 flex items-end gap-2 bg-surface/40">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Type a message…"
                className="flex-1 min-w-0 bg-base border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none max-h-32"
              />
              {/* "Talk to Jeff" — customer opt-in entry into voice
                  mode per the user's directive. §A18 invitation
                  label; §A8 frames Jeff as a participant, not a
                  feature flag. */}
              <button
                type="button"
                onClick={() => setVoiceMode(true)}
                aria-label="Talk to Jeff"
                title="Talk to Jeff — real-time voice conversation"
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-default hover:border-strong text-muted hover:text-primary"
              >
                <Mic className="w-4 h-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                aria-label="Send"
                style={{ backgroundColor: config.color }}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[#09090B] disabled:opacity-40"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="w-4 h-4" aria-hidden />
                )}
              </button>
            </div>
          )}

          {config.displayName && (
            <div className="text-center text-[10px] text-muted py-1 border-t border-default">
              Powered by C.A.R.E
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Bubble({
  message,
  accent,
}: {
  message: Message;
  accent: string;
}) {
  const isCustomer = message.authorType === "customer";
  if (message.authorType === "system") {
    return (
      <div className="text-center text-[10px] text-muted italic py-1">
        {message.body}
      </div>
    );
  }
  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div
        style={
          isCustomer ? { backgroundColor: accent, color: "#09090B" } : undefined
        }
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isCustomer ? "rounded-br-sm" : "bg-surface text-primary border border-default rounded-bl-sm"
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}

/**
 * Voice surface — Phase 9 commit 1. §A14 multi-state UI for the
 * real-time conversation loop. Each phase renders a distinct
 * affordance:
 *
 *   idle         — large mic button. Press-and-hold to record.
 *   recording    — pulsing red ring + "Release to send"
 *   transcribing — "Transcribing…"
 *   thinking     — "Jeff is thinking…"
 *   speaking     — pulsing speaker icon + "Jeff is speaking"
 *   error        — fall back to idle visually, error string
 *                  renders above this surface
 *
 * The "Back to typing" affordance exits voice mode entirely.
 * Per §A18 the label is invitational — "Back to typing" rather
 * than "Disable voice."
 */
function VoiceSurface({
  phase,
  accent,
  transcript,
  onPress,
  onRelease,
  onExit,
}: {
  phase:
    | "idle"
    | "recording"
    | "transcribing"
    | "thinking"
    | "speaking"
    | "error";
  accent: string;
  transcript: string | null;
  onPress: () => void;
  onRelease: () => void;
  onExit: () => void;
}) {
  const labelByPhase: Record<typeof phase, string> = {
    idle: "Press and hold to speak",
    recording: "Listening… release to send",
    transcribing: "Transcribing…",
    thinking: "Jeff is thinking…",
    speaking: "Jeff is speaking",
    error: "Press and hold to try again",
  };

  const buttonDisabled =
    phase === "transcribing" || phase === "thinking" || phase === "speaking";

  return (
    <div className="border-t border-default px-4 py-4 bg-surface/40 flex flex-col items-center gap-3">
      {transcript && phase !== "idle" && phase !== "recording" && (
        <p className="text-[11px] text-muted italic text-center max-w-[280px]">
          You said: &ldquo;{transcript}&rdquo;
        </p>
      )}
      <button
        type="button"
        onPointerDown={onPress}
        onPointerUp={onRelease}
        onPointerLeave={onRelease}
        onPointerCancel={onRelease}
        disabled={buttonDisabled}
        aria-label="Push to talk"
        style={{
          backgroundColor:
            phase === "recording" ? "#ef4444" : accent,
        }}
        className={`relative w-16 h-16 rounded-full text-[#09090B] flex items-center justify-center transition-transform disabled:opacity-50 ${
          phase === "recording" ? "scale-110" : "scale-100"
        }`}
      >
        {phase === "transcribing" || phase === "thinking" ? (
          <Loader2 className="w-7 h-7 animate-spin" aria-hidden />
        ) : phase === "speaking" ? (
          <Volume2 className="w-7 h-7 animate-pulse" aria-hidden />
        ) : (
          <Mic className="w-7 h-7" aria-hidden />
        )}
        {phase === "recording" && (
          <span
            className="absolute inset-0 rounded-full border-2 border-red-300 animate-ping"
            aria-hidden
          />
        )}
      </button>
      <p className="text-xs text-secondary text-center">
        {labelByPhase[phase]}
      </p>
      <button
        type="button"
        onClick={onExit}
        className="text-[10px] text-muted hover:text-primary underline-offset-2 hover:underline"
      >
        Back to typing
      </button>
    </div>
  );
}
