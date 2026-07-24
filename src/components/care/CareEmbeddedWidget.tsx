"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Phone, RotateCcw, Send, X } from "lucide-react";
import { VoiceSurface } from "./voice/VoiceSurface";
import { useVoiceMode } from "./voice/useVoiceMode";
import { LearningHint } from "@/components/learning/LearningHint";
import { HandoffCard, type HandoffCardPayload } from "./HandoffCard";
import { DEFAULT_BUSINESS_TYPE, type BusinessType } from "@/lib/care/handoverTopics";

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
  /** Handover capture (0188) — drives the concern-topic list + order field on the card. */
  businessType: BusinessType;
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
  businessType: DEFAULT_BUSINESS_TYPE,
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
  // Handover capture (0188) — the card shown when Jeff hands off to a human.
  const [handoffNeeded, setHandoffNeeded] = useState(false);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  // F1 (A34/§3.4): true when the server couldn't persist the concern (pre-0188 window).
  const [concernDeferredNote, setConcernDeferredNote] = useState(false);
  // Proactive (§1.5.2): handed off to a human — drives the standing "an agent will reply"
  // indicator so the customer isn't left in silence after the one-time notice scrolls away.
  const [handedOff, setHandedOff] = useState(false);
  // Read-receipt (A21 parity with CareChatWidget): when the customer last viewed the
  // conversation (ms). Drives the unread dot on the collapsed bubble.
  const [lastViewedAt, setLastViewedAt] = useState<number>(0);
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

  // ─── Live Monitor presence (0192) ──────────────────────────
  // Anonymous, per-session visitor id (founder decision 2026-07-24:
  // presence-only, no PII). Stored per-embedToken so a returning
  // visitor keeps one identity for the browser session rather than
  // spawning a new presence row on every reload.
  const [visitorId, setVisitorId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `care-widget-visitor:${embedToken}`;
    let v = window.localStorage.getItem(key);
    if (!v) {
      v =
        window.crypto?.randomUUID?.() ??
        `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(key, v);
    }
    setVisitorId(v);
  }, [embedToken]);

  // Audit A4 (2026-07-24): the host script (public/care-widget.js) posts the current host page
  // (on load + SPA navigation), which is more accurate than document.referrer (load-time only).
  // Held in a ref so updates don't reset the heartbeat interval. Only accepted from our parent.
  const hostPageRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const d = e.data;
      if (!d || d.type !== "care:host:page" || typeof d.url !== "string") return;
      hostPageRef.current = d.url.slice(0, 512);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Heartbeat while the widget is mounted so the tenant's Live Monitor
  // sees this visitor + the host page they're on. Best-effort: a failed
  // beat never touches the chat. The iframe can only learn the host page
  // from document.referrer (its own URL is the widget route), so page is
  // the referring host URL — accurate on load, and the honest limit is
  // that host SPA route changes aren't seen without a host-script signal.
  useEffect(() => {
    if (!visitorId || typeof window === "undefined") return;
    let cancelled = false;
    const beat = () => {
      void fetch("/api/care/widget/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: embedToken,
          visitorId,
          // Prefer the host-reported page (accurate on SPA nav); fall back to referrer.
          page: hostPageRef.current || document.referrer || null,
          conversationId: session?.conversationId ?? null,
        }),
        keepalive: true,
      }).catch(() => {
        /* best-effort presence */
      });
    };
    beat();
    const id = window.setInterval(() => {
      if (!cancelled) beat();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [visitorId, embedToken, session?.conversationId]);

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
      if (data.handoffCaptureNeeded) setHandoffNeeded(true);
      if (typeof data.conversation?.aiResponding === "boolean") {
        setHandedOff(data.conversation.aiResponding === false);
      }
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

  // ─── Read-receipt (A21 parity with CareChatWidget) ─────────
  // Restore last-viewed on mount so a returning visitor who already read a reply doesn't see a
  // false unread dot.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`care-widget-lastview:${embedToken}`);
    if (raw) setLastViewedAt(Number(raw) || 0);
  }, [embedToken]);
  // While open the customer is looking → mark everything seen (on open + as messages arrive).
  useEffect(() => {
    if (!open) return;
    const now = Date.now();
    setLastViewedAt(now);
    if (typeof window !== "undefined")
      window.localStorage.setItem(`care-widget-lastview:${embedToken}`, String(now));
  }, [open, messages.length, embedToken]);
  // Gentle collapsed-state poll (active session only, 30s, tab-paused) so a reply that lands
  // while closed is fetched and lights the dot. Without it the dot could never light.
  useEffect(() => {
    if (open || !session) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadMessages();
    }, 30000);
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
      if (data.handoff) {
        setHandoffNeeded(true);
        setHandoffDismissed(false);
      }
      if (typeof data.aiResponding === "boolean") setHandedOff(data.aiResponding === false);
    } catch {
      setError("Couldn't reach the server.");
      setDraft(body);
      setMessages((p) => p.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      setAiThinking(false);
    }
  };

  // Submit the handoff capture card (0188). Best-effort; keeps the card up on failure.
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
      // Audit F1 (A34 #2 / §3.4): honest note when the concern couldn't persist (pre-0188).
      const j = await res.json().catch(() => null);
      setConcernDeferredNote(Boolean(j?.concernDeferred));
      setHandoffNeeded(false);
      setHandoffDismissed(true);
      void loadMessages();
    } catch {
      setHandoffError("Couldn't reach the server.");
    } finally {
      setHandoffSubmitting(false);
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
    // Voice handoff: the hook already ended the call; surface the capture card in the
    // text view the customer drops back into.
    onHandoff: () => {
      setHandoffNeeded(true);
      setHandoffDismissed(false);
    },
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
    setHandoffNeeded(false);
    setHandoffDismissed(false);
    setHandoffError(null);
    setConcernDeferredNote(false);
    setHandedOff(false);
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
      <div
        role="alert"
        className="fixed bottom-4 right-4 w-72 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300"
      >
        {bootstrapError}
      </div>
    );
  }

  const posClass =
    config.position === "bottom-left" ? "bottom-4 left-4" : "bottom-4 right-4";

  return (
    <>
      {!open && (
        // Wrapper carries the fixed position so the unread dot can sit OUTSIDE the button's
        // overflow-hidden (which clips the logo to the circle and would otherwise clip the dot).
        <div className={`fixed ${posClass} w-14 h-14`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open support chat"
            style={{ backgroundColor: config.color }}
            className="w-14 h-14 rounded-full text-[#09090B] shadow-lg hover:scale-105 transition-transform flex items-center justify-center overflow-hidden"
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
          {/* Read-receipt unread dot (A21 parity): a reply arrived while collapsed. */}
          {messages.some(
            (m) =>
              m.authorType !== "customer" &&
              Date.parse(m.createdAt) > lastViewedAt
          ) && (
            <span
              aria-hidden
              // pointer-events-none: this dot is a SIBLING hoisted OUT of the button (to escape the
              // button's overflow-hidden), so without it the dot paints on top of the button's
              // top-right corner and eats taps there — a dead ~12px zone on the launcher whenever an
              // unread reply exists (audit 2026-07-24). The dot is decoration; clicks must pass through.
              className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-base rounded-full pointer-events-none"
            />
          )}
        </div>
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

          {/* role=alert so a screen-reader customer HEARS why a send failed. */}
          {error && (
            <div
              role="alert"
              className="px-4 py-2 text-[11px] text-red-700 dark:text-red-400 border-t border-red-500/30 bg-red-500/5"
            >
              {error}
            </div>
          )}

          {/* Standing "waiting for an agent" indicator (§1.5.2) — keeps the customer oriented
              after handoff until a human actually replies; hides once an agent message lands. */}
          {handedOff &&
            !(handoffNeeded && !handoffDismissed) &&
            !messages.some((m) => m.authorType === "agent") && (
              <div className="mx-4 my-2 flex items-center gap-2 rounded-lg border border-default bg-surface/50 px-3 py-2 text-[11px] text-secondary">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full"
                    style={{ backgroundColor: `${config.color}99` }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                </span>
                A member of our team will reply right here — you&apos;ll see it as soon as they do.
              </div>
            )}

          {/* F1 (A34/§3.4): honest note when the concern couldn't be persisted yet. */}
          {concernDeferredNote && (
            <div className="mx-4 my-2 rounded-lg border border-default bg-surface/50 px-3 py-2 text-[11px] text-secondary">
              Thanks — we&apos;ve got your details. We couldn&apos;t attach your specific
              concern just now, but a teammate will follow up on it.
            </div>
          )}

          {/* Handoff capture card (0188) — shown when Jeff hands off to a human. */}
          {handoffNeeded && !handoffDismissed && (
            <HandoffCard
              businessType={config.businessType}
              submitting={handoffSubmitting}
              error={handoffError}
              onSubmit={submitHandoff}
              onSkip={() => setHandoffDismissed(true)}
            />
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
