"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Phone, RotateCcw, Send, X } from "lucide-react";
import { VoiceSurface } from "./voice/VoiceSurface";
import { useVoiceMode } from "./voice/useVoiceMode";
import { LearningHint } from "@/components/learning/LearningHint";

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
  /** Per-tenant agent name. Default 'Jeff' if bootstrap omits. */
  aiName: string;
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
  aiName: "Jeff",
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

  // ─── Phase 9 voice mode (shared hook) ──────────────────────
  // Per §A13 the voice loop lives in src/components/care/voice/
  // so adding a third widget surface later means import, not
  // copy-paste.

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

  // Bootstrap + refresh config from the server.
  //
  // L3.1 fix: previously this was a mount-only fetch — if the
  // tenant operator changed the widget greeting / color / etc
  // while a customer had the widget open, the customer kept
  // seeing the OLD config until they reloaded the page.
  // (The AI personality side updates automatically because
  // ai_product_context is read server-side at every /messages
  // call. The widget's visual config was the gap.)
  //
  // Three refresh triggers:
  //   - Initial mount (unchanged)
  //   - Window focus (customer came back from another tab,
  //     potentially after the operator changed settings)
  //   - 5-minute interval as backstop for long-lived sessions
  //     where the customer never refocuses the tab
  const loadConfig = useCallback(async () => {
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
  }, [embedToken]);
  useEffect(() => {
    void loadConfig();
    const onFocus = () => {
      void loadConfig();
    };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(loadConfig, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [loadConfig]);

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
        // Restore the draft so the customer can retry without re-typing.
        setDraft(body);
        setMessages((p) => p.filter((m) => m.id !== tempId));
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setError("Couldn't reach the server.");
      setDraft(body);
      setMessages((p) => p.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      setAiThinking(false);
    }
  };

  const {
    voiceMode,
    voicePhase,
    voiceTranscript,
    startCall,
    endCall,
    retryCall,
    permissionDeniedSteps,
  } = useVoiceMode({
    ensureSession,
    onCustomerMessageOptimistic: ({ tempId, body }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          authorType: "customer",
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    onMessagesReturned: (msgs) => {
      setMessages(
        msgs.map((m, i) => ({
          id: m.id ?? `msg-${i}`,
          authorType: m.authorType,
          body: m.body,
          createdAt: m.createdAt ?? new Date().toISOString(),
        }))
      );
    },
    onRemoveOptimistic: (tempId) => {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    },
    onError: setError,
  });

  // Reset: end any voice call, wipe local session, clear messages.
  // The next message starts a fresh conversation server-side. The
  // previous one stays in the agent inbox for follow-up; the
  // customer just gets a clean slate to start a new topic.
  const resetConversation = useCallback(() => {
    if (voiceMode) endCall();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setSession(null);
    setMessages([]);
    setError(null);
    setDraft("");
  }, [voiceMode, endCall, storageKey]);

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
          className={`fixed ${posClass} w-14 h-14 rounded-full text-[#09090B] shadow-lg hover:scale-105 transition-transform flex items-center justify-center overflow-hidden`}
        >
          {/* Per audit H4 (2026-06-24): the launcher bubble is the
              MOST prominent brand surface (always visible on the
              customer's site). Show the tenant logo here when set;
              fall back to the generic chat icon. SECURITY: <img src>
              only — never <object>/inline SVG (sandbox preserved). */}
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.logoUrl}
              alt=""
              className="w-9 h-9 rounded-full object-contain"
            />
          ) : (
            <MessageCircle className="w-6 h-6" aria-hidden />
          )}
        </button>
      )}

      {open && (
        <div
          className={`fixed ${posClass} w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100dvh-2rem))] bg-base border border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-[env(safe-area-inset-bottom)]`}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b border-default flex items-center justify-between"
            style={{ backgroundColor: `${config.color}1A` }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Per audit H4 (2026-06-24): the uploaded brand logo
                  is now actually rendered. SECURITY: render ONLY via
                  <img src> — never <object> or inline SVG — so an
                  SVG logo's scripts stay sandboxed by the browser
                  (documented constraint in the 0064 closure). */}
              {config.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.logoUrl}
                  alt=""
                  className="w-8 h-8 rounded-lg object-contain shrink-0 bg-base"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary truncate">
                  {config.greeting}
                </p>
                <p className="text-[11px] text-muted truncate">
                  {config.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {session && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Start a new conversation? Your current one will stay with our team but you'll be talking on a fresh thread."
                      )
                    ) {
                      resetConversation();
                    }
                  }}
                  aria-label="Start a new conversation"
                  title="Start a new conversation"
                  className="text-muted hover:text-primary p-1.5 rounded-lg hover:bg-surface-raised"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  // L2.2 fix: end voice call on widget close
                  // (privacy — mic should not stay live after
                  // the customer dismisses the panel).
                  if (voiceMode) endCall();
                  setOpen(false);
                }}
                aria-label="Close"
                className="text-muted hover:text-primary p-1.5 rounded-lg hover:bg-surface-raised"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Stream */}
          {/* a11y: role=log + polite live region announces incoming replies to a
              customer's screen reader (SRs announce only additions, not the initial
              history). Same fix as CareChatWidget — the two widgets share this. */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Support conversation"
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {messages.length === 0 && (
              <div className="text-center px-4 py-8">
                {config.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={config.logoUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl object-contain mx-auto mb-3 bg-base"
                  />
                )}
                <p className="text-sm font-medium text-primary mb-1">
                  Hi, my name is {config.aiName}.
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

          {/* Phase 9 — call mode replaces the text composer
              when voiceMode is active. */}
          {voiceMode ? (
            <VoiceSurface
              phase={voicePhase}
              accent={config.color}
              transcript={voiceTranscript}
              permissionDeniedSteps={permissionDeniedSteps}
              onRetry={() => void retryCall()}
              onEnd={endCall}
            />
          ) : (
            <LearningHint
              as="block"
              category="C.A.R.E · Chat Widget"
              title="The message composer"
              whatItIs="Where a visitor on a customer's own site types to the AI agent, or taps the phone to talk. Enter sends; Shift+Enter adds a line."
              why="This widget lives on someone else's website, styled in their color. The composer stays deliberately bare — no pre-chat form, no required email — because a visitor who has to fill out fields to say hello usually just leaves. Fewer fields, more conversations started."
              how="Type and press Enter. Tap the phone icon for a hands-free voice call. The thread persists on this device, and an agent reply lands here within a few seconds without a refresh."
              principle="Every field between a visitor and their first message is a place they quietly give up."
            >
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
                aria-label="Type your message"
                className="flex-1 min-w-0 bg-base border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none max-h-32"
              />
              {/* "Call Jeff" — customer opt-in to phone-call
                  mode. §A18 invitation label; §A8 frames Jeff
                  as a participant, not a feature flag. */}
              <button
                type="button"
                onClick={() => void startCall()}
                aria-label={`Call ${config.aiName}`}
                title={`Call ${config.aiName} — real-time voice conversation`}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-default hover:border-strong text-muted hover:text-primary"
              >
                <Phone className="w-4 h-4" aria-hidden />
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
            </LearningHint>
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
