"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
import { LearningHint } from "@/components/learning/LearningHint";
import { HandoffCard, type HandoffCardPayload } from "./HandoffCard";
import { DEFAULT_BUSINESS_TYPE, type BusinessType } from "@/lib/care/handoverTopics";

/**
 * Route prefixes where the customer-facing Care widget MUST NOT
 * render. These are agent-side workspaces (C.A.R.E inbox, topic
 * chats) where the Jeff FAB visually collides with the agent's
 * own send/compose surface and signals nothing useful to the
 * agent who is already inside the agent product. The widget
 * remains everywhere else (public marketing pages + the rest of
 * the dashboard) because that's where it serves a real visitor.
 */
const WIDGET_HIDDEN_PREFIXES = [
  "/dashboard/care",
  "/dashboard/chats",
];

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
  kind?: "message" | "attachment" | "system";
  mediaUrl?: string | null;
  mediaType?: string | null;
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
  const pathname = usePathname();
  const hiddenHere =
    pathname !== null &&
    WIDGET_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [conversationClosed, setConversationClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Handover capture (0188): the card that appears when Jeff hands off to a human.
  const [handoffNeeded, setHandoffNeeded] = useState(false);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>(DEFAULT_BUSINESS_TYPE);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
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
      if (data.businessType) setBusinessType(data.businessType as BusinessType);
      // Show the capture card if the server says this conversation was handed to a human
      // and the customer hasn't been captured yet (persists across reloads).
      if (data.handoffCaptureNeeded) setHandoffNeeded(true);
    } catch (e) {
      console.warn("[care widget] couldn't load messages", e);
    }
  }, [session]);

  useEffect(() => {
    if (open && session) {
      void loadMessages();
    }
  }, [open, session, loadMessages]);

  // Poll for new messages while the panel is open — this is what lets an AGENT's reply
  // (after a handoff) land in the customer's open widget without a refresh. Without it the
  // direct widget went silent post-handoff: the customer sent messages but never saw the
  // human's response until they reopened the chat — the "no smooth customer interaction"
  // gap. Mirrors the embedded widget: 4s, paused when the tab is hidden or a send is in
  // flight (so we never clobber optimistic state), only while open + session. loadMessages
  // already handles 404/410 by clearing local state.
  const sendingRef = useRef(false);
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);
  useEffect(() => {
    if (!open || !session) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (sendingRef.current) return;
      void loadMessages();
    }, 4000);
    return () => window.clearInterval(id);
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
    // Voice handoff: the hook already ended the call (a voice channel can't route to the
    // human); surface the capture card in the text view the customer drops back into.
    onHandoff: () => {
      setHandoffNeeded(true);
      setHandoffDismissed(false);
    },
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
    // A fresh conversation is AI-first again — clear any handoff-card state.
    setHandoffNeeded(false);
    setHandoffDismissed(false);
    setHandoffError(null);
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
        // Log the actual status + body so the founder can see
        // WHY Jeff failed when triaging from the DevTools console
        // instead of just "Couldn't send."
        try {
          const errBody = await res.clone().text();
          // eslint-disable-next-line no-console
          console.error(
            `[care-widget] POST /messages → ${res.status}: ${errBody.slice(0, 400)}`
          );
        } catch {
          // eslint-disable-next-line no-console
          console.error(`[care-widget] POST /messages → ${res.status} (no body)`);
        }
        // (410 handled below alongside the in-banner detail.)
        // Stale-session recovery: a 401 (token rejected) or 404
        // (conversation gone) means the localStorage session
        // points at something the server no longer recognises.
        // Wipe it, start a fresh conversation, and re-send the
        // message inline so the customer sees their text land
        // instead of "Couldn't send". This is the single most
        // common Jeff failure mode: a developer wiped the DB or
        // the conversation was archived out from under a long-
        // lived browser tab.
        // Capture the original response's error info BEFORE the
        // recovery branch consumes the body. We surface this to
        // the user no matter which path runs.
        let initialErrorString = `HTTP ${res.status}`;
        try {
          const errJson = await res.clone().json();
          const e = errJson?.error ?? null;
          const d = errJson?.detail ?? null;
          if (typeof e === "string" || typeof d === "string") {
            initialErrorString = `${res.status} ${[e, d].filter(Boolean).join(" — ").slice(0, 220)}`;
          }
        } catch {
          /* response wasn't JSON */
        }
        // Stale-session recovery: a 401 (token rejected) or 404
        // (conversation gone) means the localStorage session
        // points at something the server no longer recognises.
        let recoveryError: string | null = null;
        if (res.status === 401 || res.status === 404) {
          clearSession();
          setSession(null);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          try {
            const sessRes = await fetch("/api/care/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            if (sessRes.ok) {
              const fresh = (await sessRes.json()) as StoredSession;
              saveSession(fresh);
              setSession(fresh);
              const retry = await fetch(
                `/api/care/conversations/${fresh.conversationId}/messages`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-care-session": fresh.sessionToken,
                  },
                  body: JSON.stringify({ body }),
                }
              );
              if (retry.ok) {
                const data = await retry.json();
                setMessages(data.messages ?? []);
                return;
              }
              // Recovery's retry also failed — capture its
              // status + body so we surface the real cause.
              try {
                const retryJson = await retry.clone().json();
                recoveryError = `recovery POST /messages → ${retry.status} ${[retryJson?.error, retryJson?.detail].filter(Boolean).join(" — ").slice(0, 220)}`;
              } catch {
                recoveryError = `recovery POST /messages → ${retry.status}`;
              }
            } else {
              try {
                const sessJson = await sessRes.clone().json();
                recoveryError = `recovery POST /conversations → ${sessRes.status} ${[sessJson?.error, sessJson?.detail].filter(Boolean).join(" — ").slice(0, 220)}`;
              } catch {
                recoveryError = `recovery POST /conversations → ${sessRes.status}`;
              }
            }
          } catch (err) {
            recoveryError = `recovery threw: ${err instanceof Error ? err.message : String(err)}`;
          }
        }
        if (res.status === 410) {
          setConversationClosed(true);
        }
        setError(
          recoveryError
            ? `${initialErrorString} · ${recoveryError}`
            : initialErrorString
        );
        // Remove the optimistic message AND restore the draft so the customer
        // can retry without re-typing — losing a member of the public's message
        // on a transient failure is a real support-experience gap.
        setDraft(body);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      const data = await res.json();
      // Replace optimistic + AI reply with the server's canonical list.
      setMessages(data.messages ?? []);
      if (data.businessType) setBusinessType(data.businessType as BusinessType);
      // Jeff just handed off → surface the capture card (unless already dismissed).
      if (data.handoff) {
        setHandoffNeeded(true);
        setHandoffDismissed(false);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[care-widget] send failed:", err);
      setError("Couldn't reach the server.");
      // Restore the draft so the customer can retry without re-typing.
      setDraft(body);
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

  // Submit the handoff capture card (0188). Best-effort: on success the card disappears
  // and the thread reloads (so the customer sees the system notice); on failure we keep
  // the card up with an inline error so they can retry — never a dead end.
  const submitHandoff = async (payload: HandoffCardPayload) => {
    if (!session || handoffSubmitting) return;
    setHandoffSubmitting(true);
    setHandoffError(null);
    try {
      const res = await fetch(
        `/api/care/conversations/${session.conversationId}/handoff`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-care-session": session.sessionToken,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setHandoffError(j?.error ?? "Couldn't save those details. Please try again.");
        return;
      }
      setHandoffNeeded(false);
      setHandoffDismissed(true);
      void loadMessages();
    } catch {
      setHandoffError("Couldn't reach the server.");
    } finally {
      setHandoffSubmitting(false);
    }
  };

  if (hiddenHere) return null;

  return (
    <>
      {/* Floating bubble button — closed state */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          title="Talk to us"
          className="fixed bottom-4 right-4 z-[55] flex items-center justify-center w-14 h-14 rounded-full bg-ember-400 hover:bg-ember-500 text-[#09090B] shadow-glow-ember transition-all hover:scale-105 mb-[env(safe-area-inset-bottom)]"
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
        // 100dvh (dynamic viewport height) shrinks when the mobile
        // keyboard opens — without this, the panel height stayed at
        // 100vh and pushed the composer off-screen behind the
        // keyboard.
        <div className="fixed bottom-4 right-4 z-[55] w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100dvh-2rem))] bg-base border border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-[env(safe-area-inset-bottom)]">
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
          {/* a11y: role=log + polite live region so a customer's screen reader
              announces incoming agent/AI replies. Single conversation per widget
              (no inbox-switch chatter), and SRs announce only ADDITIONS to a live
              region, not its initial content — so opening the chat doesn't read the
              whole history. */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Support conversation"
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-full bg-ember-400/15 flex items-center justify-center mb-3">
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
              <MessageBubble
                key={m.id}
                message={m}
                sessionToken={session?.sessionToken}
                conversationId={session?.conversationId}
              />
            ))}
            {aiThinking && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                Thinking…
              </div>
            )}
          </div>

          {/* Error banner — role=alert so a screen-reader customer HEARS why a
              send failed (the message container's role=log is separate). */}
          {error && (
            <div
              role="alert"
              className="px-4 py-2 text-[11px] text-red-400 border-t border-red-500/30 bg-red-500/5"
            >
              {error}
            </div>
          )}

          {/* Handoff capture card (0188) — appears when Jeff hands off to a human.
              Sits above the composer so the customer can still type while it's open. */}
          {handoffNeeded && !handoffDismissed && !conversationClosed && (
            <HandoffCard
              businessType={businessType}
              submitting={handoffSubmitting}
              error={handoffError}
              onSubmit={submitHandoff}
              onSkip={() => setHandoffDismissed(true)}
            />
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
              <LearningHint
                as="block"
                category="C.A.R.E · Chat Widget"
                title="The message composer"
                whatItIs="The box where a visitor types to Jeff, attaches an image or PDF, or switches to a live voice call. Enter sends; Shift+Enter adds a line."
                why="Support tools usually gate the first message behind a form — 'describe your issue in 200 characters,' pick a category, leave an email. Every field is a place a visitor abandons. This composer asks for nothing but the message, so the conversation starts before the friction can end it."
                how="Type and press Enter. Attach a file with the paperclip if a screenshot explains it faster than words. Tap the phone to talk instead of type. Your thread is remembered on this device, so navigating the site doesn't lose it."
                principle="The cheapest way to lose a customer's question is to make them fill out a form to ask it."
              >
              <div className="border-t border-default p-3 flex items-end gap-2 bg-surface/40">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message…"
                  aria-label="Type your message"
                  rows={1}
                  disabled={sending}
                  className="flex-1 min-w-0 bg-base border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none max-h-32"
                />
                {/* Asset System v1 — customer-side upload.
                    10 MB cap, images + PDF only. Auto-classified
                    to this conversation. */}
                <CustomerUploadButton
                  sessionToken={session?.sessionToken ?? null}
                  conversationId={session?.conversationId ?? null}
                  onUploaded={() => {
                    void loadMessages();
                  }}
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
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-ember-400 hover:bg-ember-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="w-4 h-4" aria-hidden />
                  )}
                </button>
              </div>
              </LearningHint>
            ))}
        </div>
      )}
    </>
  );
}

function MessageBubble({
  message,
  sessionToken,
  conversationId,
}: {
  message: Message;
  sessionToken?: string | null;
  conversationId?: string | null;
}) {
  const isCustomer = message.authorType === "customer";
  const isSystem = message.authorType === "system";

  if (isSystem) {
    return (
      <div className="text-center text-[10px] text-muted italic py-1">
        {message.body}
      </div>
    );
  }

  const isAttachment = message.kind === "attachment" && !!message.mediaUrl;

  return (
    <div
      className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isCustomer
            ? "bg-ember-400 text-[#09090B] rounded-br-sm"
            : "bg-surface text-primary border border-default rounded-bl-sm"
        }`}
      >
        {isAttachment ? (
          <CustomerAttachmentBubble
            message={message}
            sessionToken={sessionToken ?? null}
            conversationId={conversationId ?? null}
            isCustomer={isCustomer}
          />
        ) : (
          message.body
        )}
      </div>
    </div>
  );
}

function CustomerAttachmentBubble({
  message,
  sessionToken,
  conversationId,
  isCustomer,
}: {
  message: Message;
  sessionToken: string | null;
  conversationId: string | null;
  isCustomer: boolean;
}) {
  const SCHEME = "assets-v1://";
  const fileId =
    message.mediaUrl && message.mediaUrl.startsWith(SCHEME)
      ? message.mediaUrl.slice(SCHEME.length)
      : null;
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(message.body);
  const [mimeType, setMimeType] = useState<string>(message.mediaType ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fileId || !sessionToken || !conversationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/care/conversations/${conversationId}/file/${fileId}`,
          { headers: { "x-care-session": sessionToken } }
        );
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setDownloadUrl(data.downloadUrl ?? null);
        if (data.title) setTitle(data.title);
        if (data.mimeType) setMimeType(data.mimeType);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId, sessionToken, conversationId]);

  const isImage = mimeType.startsWith("image/");

  return (
    <div className={`flex flex-col gap-1 ${isCustomer ? "items-end" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8L9.41 17.32a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        <span className="font-medium">{title}</span>
      </div>
      {isImage && downloadUrl && (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl}
            alt={title}
            className="max-h-40 rounded-md object-contain bg-base/40"
            loading="lazy"
          />
        </a>
      )}
      {!loading && downloadUrl && !isImage && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] underline"
        >
          Download
        </a>
      )}
    </div>
  );
}

// Stub for read-receipt tracking; Sprint 2 hooks this to the
// "last seen" timestamp the agent inbox surfaces.
function messageWasSeen(_m: Message): boolean {
  return true;
}


/**
 * Customer-side upload button — inline in the widget composer.
 * Authenticated by the widget's session token (NOT user auth).
 * 10 MB cap, images + PDF only enforced server-side in
 * /api/care/conversations/[id]/upload.
 */
function CustomerUploadButton({
  sessionToken,
  conversationId,
  onUploaded,
}: {
  sessionToken: string | null;
  conversationId: string | null;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !sessionToken || !conversationId)
      return;
    const f = files[0];
    if (!f) return;
    setErr(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch(
        `/api/care/conversations/${conversationId}/upload`,
        {
          method: "POST",
          headers: { "x-care-session": sessionToken },
          body: form,
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error ?? `Upload failed (${res.status})`);
        return;
      }
      onUploaded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !sessionToken}
        aria-label="Attach a file"
        title={err ?? "Attach an image or PDF (10 MB max)"}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-default hover:border-strong text-muted hover:text-primary disabled:opacity-40"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8L9.41 17.32a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </>
  );
}
