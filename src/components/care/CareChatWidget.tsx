"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  MessageCircle,
  Phone,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { VoiceSurface } from "./voice/VoiceSurface";
import { useVoiceMode } from "./voice/useVoiceMode";

/**
 * Customer-facing Care chat widget. Floats bottom-right; expands to
 * a chat panel on tap. Customer talks to AI first; if the AI hands
 * off, a teammate picks up from the inbox.
 *
 * State persistence: conversation id + session token are stored in
 * localStorage so a visitor can navigate around the site without
 * losing their conversation. Per §A10 we don't load any data the
 * customer didn't author themselves — no fingerprinting, no
 * profile pre-fill.
 *
 * Visual posture: looks like a real support chat (Intercom-shaped)
 * but warmer in voice and lower-friction. No "please describe your
 * issue in 200 characters" forms. Just open it and type.
 */

const STORAGE_KEY = "elostate-care-session";

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

function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.conversationId && parsed.sessionToken) return parsed;
  } catch {
    /* malformed → ignore */
  }
  return null;
}

function saveSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function CareChatWidget() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [conversationClosed, setConversationClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore session on mount.
  useEffect(() => {
    const existing = loadSession();
    if (existing) setSession(existing);
  }, []);

  // Auto-focus the composer when the panel opens.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Auto-scroll to the bottom whenever new messages land.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, aiThinking]);

  // Load message history when a session exists and the panel opens.
  const loadMessages = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(
        `/api/care/conversations/${session.conversationId}/messages`,
        {
          headers: { "x-care-session": session.sessionToken },
        }
      );
      if (!res.ok) {
        if (res.status === 404 || res.status === 410) {
          // Conversation gone or closed — wipe local and start fresh.
          clearSession();
          setSession(null);
          setMessages([]);
        }
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
      if (data.conversation?.status === "closed") {
        setConversationClosed(true);
      }
    } catch (e) {
      console.warn("[care widget] couldn't load messages", e);
    }
  }, [session]);

  useEffect(() => {
    if (open && session) {
      void loadMessages();
    }
  }, [open, session, loadMessages]);

  const ensureSession = useCallback(async (): Promise<StoredSession | null> => {
    if (session) return session;
    try {
      const res = await fetch("/api/care/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError("Couldn't start a conversation. Please try again.");
        return null;
      }
      const data = (await res.json()) as StoredSession;
      saveSession(data);
      setSession(data);
      return data;
    } catch {
      setError("Couldn't reach the server.");
      return null;
    }
  }, [session]);

  // ─── Phase 9 voice mode (shared hook) ──────────────────────
  // Per §A13 the voice loop lives in src/components/care/voice/
  // so this widget consumes the same logic as CareEmbeddedWidget.
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

  // Reset the conversation. Ends any in-flight voice call, wipes
  // local state, and clears the stored session — the next message
  // the customer sends starts a brand-new conversation on the
  // server. The previous conversation row stays in the agent
  // inbox; we're just giving the customer a clean slate.
  const resetConversation = useCallback(() => {
    if (voiceMode) endCall();
    clearSession();
    setSession(null);
    setMessages([]);
    setConversationClosed(false);
    setError(null);
    setDraft("");
  }, [voiceMode, endCall]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setError(null);

    const active = await ensureSession();
    if (!active) return;

    setDraft("");
    setSending(true);
    setAiThinking(true);

    // Optimistic: drop the customer's message into the list
    // immediately so they see it land before the AI returns.
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
        if (res.status === 410) {
          setConversationClosed(true);
        }
        setError("Couldn't send. Please try again.");
        // Remove the optimistic message so the user can retry.
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      const data = await res.json();
      // Replace optimistic + AI reply with the server's canonical list.
      setMessages(data.messages ?? []);
    } catch {
      setError("Couldn't reach the server.");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      setAiThinking(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {/* Floating bubble button — closed state */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          title="Talk to us"
          className="fixed bottom-4 right-4 z-[55] flex items-center justify-center w-14 h-14 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] shadow-glow-ember transition-all hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" aria-hidden />
          {messages.some(
            (m) => m.authorType !== "customer" && !messageWasSeen(m)
          ) && (
            <span
              aria-hidden
              className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-base rounded-full"
            />
          )}
        </button>
      )}

      {/* Expanded chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-[55] w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-2rem))] bg-base border border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-default bg-surface/60">
            <div>
              <p className="text-sm font-semibold text-primary">
                We&apos;re here to help
              </p>
              <p className="text-[11px] text-muted">
                Typical reply: a few seconds
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Reset — start a fresh conversation. Only shown
                  when there's an existing session; nothing to
                  reset on a brand-new widget open. Confirm-on-
                  click so the customer doesn't lose their thread
                  to a fat-finger. */}
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
                  className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-raised"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  // L2.2 fix: ending any active voice call when
                  // the widget closes. Without this, the mic stays
                  // live until the page unloads — a real privacy
                  // gap (customer thinks they closed the chat, but
                  // their mic is still streaming).
                  if (voiceMode) endCall();
                  setOpen(false);
                }}
                aria-label="Close chat"
                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-raised"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Message stream */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-full bg-[#FACC15]/15 flex items-center justify-center mb-3">
                  <MessageCircle
                    className="w-5 h-5 text-brand"
                    aria-hidden
                  />
                </div>
                <p className="text-sm font-medium text-primary mb-1">
                  Hi, my name is Jeff.
                </p>
                <p className="text-xs text-secondary leading-relaxed max-w-[260px]">
                  Ask anything — pricing, how it works, whether
                  we&apos;re a fit. A real person sees these too.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {aiThinking && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                Thinking…
              </div>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="px-4 py-2 text-[11px] text-red-400 border-t border-red-500/30 bg-red-500/5">
              {error}
            </div>
          )}

          {/* Closed banner */}
          {conversationClosed && (
            <div className="px-4 py-2 text-[11px] text-secondary border-t border-default bg-surface/40">
              This conversation is closed.{" "}
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  setSession(null);
                  setMessages([]);
                  setConversationClosed(false);
                }}
                className="text-brand underline"
              >
                Start a new one
              </button>
              .
            </div>
          )}

          {/* Composer — text mode OR call mode (Phase 9). */}
          {!conversationClosed &&
            (voiceMode ? (
              <VoiceSurface
                phase={voicePhase}
                accent="#FACC15"
                transcript={voiceTranscript}
                permissionDeniedSteps={permissionDeniedSteps}
                onRetry={() => void retryCall()}
                onEnd={endCall}
              />
            ) : (
              <div className="border-t border-default p-3 flex items-end gap-2 bg-surface/40">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message…"
                  rows={1}
                  disabled={sending}
                  className="flex-1 min-w-0 bg-base border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none max-h-32"
                />
                {/* "Call Jeff" — customer opt-in to phone-call
                    mode. Click starts a continuous conversation
                    (hands-free, VAD-driven turns). */}
                <button
                  type="button"
                  onClick={() => void startCall()}
                  aria-label="Call Jeff"
                  title="Call Jeff — real-time voice conversation"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-default hover:border-strong text-muted hover:text-primary"
                >
                  <Phone className="w-4 h-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="w-4 h-4" aria-hidden />
                  )}
                </button>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isCustomer = message.authorType === "customer";
  const isSystem = message.authorType === "system";

  if (isSystem) {
    return (
      <div className="text-center text-[10px] text-muted italic py-1">
        {message.body}
      </div>
    );
  }

  return (
    <div
      className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isCustomer
            ? "bg-[#FACC15] text-[#09090B] rounded-br-sm"
            : "bg-surface text-primary border border-default rounded-bl-sm"
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}

// Stub for read-receipt tracking; Sprint 2 hooks this to the
// "last seen" timestamp the agent inbox surfaces.
function messageWasSeen(_m: Message): boolean {
  return true;
}
