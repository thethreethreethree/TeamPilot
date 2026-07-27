"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARE_PREFER_DESKTOP_KEY } from "@/components/care/mobile/MobileHomeRedirect";
import {
  Sparkles,
  AlignLeft,
  GraduationCap,
  Brain,
  ListPlus,
  MessageSquare,
  Home,
  Settings,
  Loader2,
  ChevronUp,
  ChevronDown,
  Wrench,
  X,
  Layers,
} from "lucide-react";
import RcdMobileSheet from "@/components/care/mobile/RcdMobileSheet";

/**
 * Mobile C.A.R.E — radial home (founder mockup 2026-07-25).
 *
 * Founder-locked spec: ① responsive web in this app, ② the ring tools call the
 * SAME backend routes as desktop (A21/A31 — one engine, not a parallel shell),
 * ③ swiping up/down on the center cycles the CONVERSATION LIST, ④ read + the five
 * tools + reply/handoff; heavier controls stay on desktop. "A 5-year-old can use it."
 *
 * Interaction (founder): the CENTER "Conversations" is tapped FIRST; that unlocks
 * the surrounding ring. Swipe up/down on the center to move through conversations.
 *
 * Governance: Layer-4 surface over the existing Layer-1/2 engine. It composes with
 * the real inbox + tool routes rather than reimplementing them (A31: a pretty shell
 * that doesn't reach the backend "does not exist"). The AI honesty/handoff rules are
 * untouched — this only changes presentation (§3.3 guide, don't overtake preserved).
 */

type Conv = {
  id: string;
  subject: string | null;
  customerName: string | null;
  lastMessagePreview?: string | null;
  status?: string | null;
  priority?: string | null;
};

type ToolKey = "copilot" | "summarize" | "coach" | "dissect" | "task";

// Ring = the three most-used tools (founder 2026-07-25). Dissect + Spawn Task moved
// into the top-left "More tools" wrench menu below to declutter the ring.
const TOOLS: {
  key: ToolKey;
  label: string;
  Icon: typeof Sparkles;
  pos: string;
}[] = [
  { key: "copilot", label: "Co-Pilot", Icon: Sparkles, pos: "top-0 left-1/2 -translate-x-1/2" },
  { key: "summarize", label: "Summarize", Icon: AlignLeft, pos: "top-[42%] left-0 -translate-y-1/2" },
  { key: "coach", label: "Ask Coach", Icon: GraduationCap, pos: "top-[42%] right-0 -translate-y-1/2" },
];
const MORE_TOOLS: { key: ToolKey; label: string; Icon: typeof Sparkles }[] = [
  { key: "dissect", label: "Dissect", Icon: Brain },
  { key: "task", label: "Spawn Task", Icon: ListPlus },
];

// Each tool → its existing route + the field to read from the JSON response. Robust
// to shape differences: we render the first meaningful string the route returns.
function toolRequest(tool: ToolKey, convId: string): { url: string; body?: unknown } {
  const base = `/api/care/agent/conversations/${convId}`;
  switch (tool) {
    case "summarize":
      return { url: `${base}/summarize`, body: {} };
    case "dissect":
      return { url: `${base}/dissect`, body: {} };
    case "coach":
      // ask-coach requires draft.min(1) — an empty draft 400s (this mobile stub was never
      // runtime-exercised). Mobile is one-tap with no draft input, so ask a sensible default
      // coaching question about the current thread; "ask" mode treats the draft as the user's question.
      return { url: `${base}/ask-coach`, body: { draft: "How should I handle this conversation?", mode: "ask" } };
    case "copilot":
      return { url: `${base}/co-pilot`, body: {} };
    case "task":
      return { url: `/api/tasks/spawn`, body: { fromCareConversationId: convId } };
  }
}

function pickResultText(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    // Verified keys: summarize → {summary}, dissect → {dissect:{...}} (0193 audit).
    for (const k of ["summary", "response", "dissect", "draft", "text", "message"]) {
      const v = d[k];
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object") {
        const inner = v as Record<string, unknown>;
        // dissect/coach objects — surface the first human-readable field.
        for (const ik of [
          "suggestedRevision",
          "summary",
          "read",
          "diagnosis",
          "headline",
          "text",
          "classification",
        ]) {
          if (typeof inner[ik] === "string" && (inner[ik] as string).trim())
            return inner[ik] as string;
        }
      }
    }
  }
  return "Done. Open this conversation on desktop for the full result.";
}

export function CareRadialHome() {
  const [convos, setConvos] = useState<Conv[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [rcdOpen, setRcdOpen] = useState(false); // Raw Conversation Data sheet

  const [sheet, setSheet] = useState<{
    tool: ToolKey;
    label: string;
    loading: boolean;
    result: string | null;
    error: string | null;
  } | null>(null);

  const [reply, setReply] = useState<{
    text: string;
    sending: boolean;
    error: string | null;
    sent: boolean;
    // Ask Coach grades the DRAFT on this same surface (A16 compose) — Coach needs
    // a non-empty draft (the route requires min length 1), so it lives here.
    coach?: { loading: boolean; suggestion: string | null; error: string | null };
  } | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const [reading, setReading] = useState<{
    loading: boolean;
    messages: { authorType: string; body: string }[];
    error: string | null;
  } | null>(null);

  const touchStartY = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/care/agent/inbox?enriched=1");
      if (!res.ok) {
        setError(`Couldn't load (HTTP ${res.status}).`);
        return;
      }
      const d = await res.json();
      // Field names verified against EnrichedConversation (src/lib/data/care.ts):
      // the customer name is customer.name; there is NO message-preview field in
      // the enriched inbox payload, so the card falls back to subject (honest —
      // a true last-message snippet isn't in this response).
      const list: Conv[] = (d.conversations ?? []).map(
        (c: Record<string, unknown>) => ({
          id: c.id as string,
          subject: (c.subject as string | null) ?? null,
          customerName:
            (c.customer as { name?: string | null } | null)?.name ?? null,
          lastMessagePreview: null,
          status: (c.status as string | null) ?? null,
          priority: (c.priority as string | null) ?? null,
        })
      );
      setConvos(list);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = convos[idx] ?? null;
  const openCount = convos.filter(
    (c) => c.status !== "closed" && c.status !== "resolved"
  ).length;
  const criticalCount = convos.filter(
    (c) =>
      c.priority === "urgent" ||
      c.status === "needs_guidance" ||
      c.status === "blocked"
  ).length;

  // Swipe up/down on the center cycles the conversation LIST (founder ③).
  function cycle(dir: 1 | -1) {
    if (convos.length === 0) return;
    setIdx((i) => (i + dir + convos.length) % convos.length);
  }
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartY.current;
    touchStartY.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientY ?? start;
    const dy = end - start;
    if (Math.abs(dy) < 30) {
      // A tap (not a swipe) on the center: first tap unlocks the ring.
      if (!unlocked) setUnlocked(true);
      return;
    }
    cycle(dy < 0 ? 1 : -1); // swipe up → next, swipe down → previous
  }

  async function sendReply() {
    if (!current || !reply || !reply.text.trim() || reply.sending) return;
    setReply({ ...reply, sending: true, error: null });
    try {
      // SAME agent-reply route as desktop — the AI honesty/handoff logic applies
      // server-side (A21/A31: one engine). Plain reply = { body }.
      const res = await fetch(
        `/api/care/agent/conversations/${current.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: reply.text.trim() }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setReply({
          ...reply,
          sending: false,
          error: data?.detail ?? data?.error ?? `Couldn't send (HTTP ${res.status}).`,
        });
        return;
      }
      setReply({ text: "", sending: false, error: null, sent: true });
      window.setTimeout(() => setReply(null), 1500);
    } catch {
      setReply({ ...reply, sending: false, error: "Couldn't reach the server." });
    }
  }

  // Open a conversation to READ its messages (founder: the "Open to read" affordance
  // was inert). Loads the thread via the same messages route and shows it in a sheet.
  async function openRead(convId: string) {
    setReading({ loading: true, messages: [], error: null });
    try {
      // GET the conversation detail — /messages is POST-only (send a reply), so a GET
      // there 405'd (founder 2026-07-25). The [id] route returns { conversation, messages }.
      const res = await fetch(`/api/care/agent/conversations/${convId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setReading({
          loading: false,
          messages: [],
          error: data?.detail ?? data?.error ?? `Couldn't load (HTTP ${res.status}).`,
        });
        return;
      }
      const msgs = (data?.messages ?? []).map(
        (m: Record<string, unknown>) => ({
          authorType:
            (m.authorType as string) ?? (m.author_type as string) ?? "customer",
          body: (m.body as string) ?? "",
        })
      );
      setReading({ loading: false, messages: msgs, error: null });
    } catch {
      setReading({
        loading: false,
        messages: [],
        error: "Couldn't reach the server.",
      });
    }
  }

  // Co-Pilot drafts a reply from the thread (route returns {draft}) → prefill the
  // reply sheet so the agent edits + sends. This is the desktop behavior (A21).
  async function runCoPilot() {
    if (!current) return;
    setSheet({ tool: "copilot", label: "Co-Pilot", loading: true, result: null, error: null });
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${current.id}/co-pilot`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.draft !== "string") {
        setSheet({
          tool: "copilot",
          label: "Co-Pilot",
          loading: false,
          result: null,
          error: data?.detail ?? data?.error ?? `Co-Pilot unavailable (HTTP ${res.status}).`,
        });
        return;
      }
      setSheet(null);
      setReply({ text: data.draft, sending: false, error: null, sent: false });
    } catch {
      setSheet({
        tool: "copilot",
        label: "Co-Pilot",
        loading: false,
        result: null,
        error: "Couldn't reach the server.",
      });
    }
  }

  // Ask Coach grades the CURRENT reply draft (route requires a non-empty draft).
  async function gradeCoach() {
    if (!current || !reply || !reply.text.trim()) return;
    const draft = reply.text;
    setReply({ ...reply, coach: { loading: true, suggestion: null, error: null } });
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${current.id}/ask-coach`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft, mode: "ask" }),
        }
      );
      const data = await res.json().catch(() => null);
      const suggestion =
        typeof data?.response?.suggestedRevision === "string"
          ? data.response.suggestedRevision
          : typeof data?.response?.classification === "string"
            ? data.response.classification
            : null;
      setReply((r) =>
        r
          ? {
              ...r,
              coach: {
                loading: false,
                suggestion: res.ok ? suggestion : null,
                error: res.ok
                  ? suggestion
                    ? null
                    : "Coach had nothing to add."
                  : data?.detail ?? data?.error ?? `Coach unavailable (HTTP ${res.status}).`,
              },
            }
          : r
      );
    } catch {
      setReply((r) =>
        r ? { ...r, coach: { loading: false, suggestion: null, error: "Couldn't reach the server." } } : r
      );
    }
  }

  async function runTool(tool: ToolKey, label: string) {
    if (!unlocked) {
      setUnlocked(true);
      return;
    }
    if (!current) return;
    // Co-Pilot drafts INTO the reply; Ask Coach grades the reply draft — both route
    // through the reply sheet, not the read-only result sheet (A16 compose, A21).
    if (tool === "copilot") {
      void runCoPilot();
      return;
    }
    if (tool === "coach") {
      setReply(
        (r) => r ?? { text: "", sending: false, error: null, sent: false }
      );
      return;
    }
    if (tool === "task") {
      // Spawn Task needs the full conversation context (SpawnSchema) — a one-shot
      // POST here would 400. Open the conversation, where that flow already lives,
      // instead of shipping a broken button (§3.4 honesty / A31). Mobile-native task
      // spawn is a follow-up.
      window.location.href = `/dashboard/care/conversations/${current.id}`;
      return;
    }
    setSheet({ tool, label, loading: true, result: null, error: null });
    try {
      const { url, body } = toolRequest(tool, current.id);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSheet({
          tool,
          label,
          loading: false,
          result: null,
          error: data?.detail ?? data?.error ?? `${label} unavailable (HTTP ${res.status}).`,
        });
        return;
      }
      setSheet({ tool, label, loading: false, result: pickResultText(data), error: null });
    } catch {
      setSheet({
        tool,
        label,
        loading: false,
        result: null,
        error: "Couldn't reach the server.",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a0a0f] text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" aria-hidden />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide">ELOSTATE</p>
            <p className="text-[10px] text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              LIVE
            </p>
          </div>
          {/* More tools (founder 2026-07-25): Dissect + Spawn Task live here, top-left,
              behind a wrench — off the ring to declutter it. */}
          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More tools"
              className="p-2 rounded-full border border-white/10 text-amber-400 active:bg-white/5"
            >
              <Wrench className="w-4 h-4" aria-hidden />
            </button>
            {moreOpen && (
              <>
                <div
                  className="fixed inset-0 z-[64]"
                  onClick={() => setMoreOpen(false)}
                  aria-hidden
                />
                <div className="absolute left-0 top-11 z-[65] w-44 rounded-xl border border-white/10 bg-[#111119] py-1 shadow-lg">
                  {MORE_TOOLS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      void runTool(key, label);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/85 hover:bg-white/5"
                  >
                    <Icon className="w-4 h-4 text-amber-400" aria-hidden />
                    {label}
                  </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {/* Escape hatch — keeps a phone user on desktop for the session if they prefer. */}
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(CARE_PREFER_DESKTOP_KEY, "1");
            } catch {
              /* ignore */
            }
            window.location.href = "/dashboard/care";
          }}
          className="text-[11px] text-white/40 border border-white/10 rounded-full px-2.5 py-1"
        >
          Desktop
        </button>
      </header>

      {/* Welcome / status card */}
      <div className="mx-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-base font-semibold">Your streamlined C.A.R.E.</p>
        <p className="mt-1 text-xs text-white/50">
          {loading
            ? "Loading your conversations…"
            : convos.length === 0
              ? "No conversations yet."
              : `${openCount} open · tap the center, then use the ring.`}
        </p>
      </div>

      {/* Radial */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="relative w-[320px] h-[320px] max-w-[86vw] max-h-[86vw]">
          {/* Ring tools */}
          {TOOLS.map(({ key, label, Icon, pos }) => (
            <button
              key={key}
              type="button"
              onClick={() => runTool(key, label)}
              aria-label={label}
              className={`absolute ${pos} w-[86px] h-[86px] rounded-full flex flex-col items-center justify-center gap-1 border transition-all ${
                unlocked
                  ? "border-amber-400/70 bg-black/60 shadow-[0_0_20px_-2px_rgba(245,200,66,0.5)]"
                  : "border-white/10 bg-black/40 opacity-40"
              }`}
            >
              <Icon className="w-5 h-5 text-amber-400" aria-hidden />
              <span className="text-[10px] font-medium text-amber-300/90">{label}</span>
            </button>
          ))}

          {/* Center — Conversations. Tap first to unlock; swipe to cycle. */}
          <button
            type="button"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={() => {
              if (!unlocked) setUnlocked(true);
            }}
            aria-label="Conversations — tap to activate, swipe up or down to browse"
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130px] h-[130px] rounded-full flex flex-col items-center justify-center gap-1 border-2 ${
              unlocked
                ? "border-amber-400 bg-black shadow-[0_0_40px_-4px_rgba(245,200,66,0.6)]"
                : "border-amber-400/60 bg-black/80 animate-pulse"
            }`}
          >
            <MessageSquare className="w-7 h-7 text-amber-400" aria-hidden />
            <span className="text-xs font-semibold text-amber-300">Conversations</span>
            {unlocked && (
              <span className="text-[9px] text-white/40 flex items-center gap-0.5">
                <ChevronUp className="w-2.5 h-2.5" /> swipe <ChevronDown className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Current conversation (below the radial) */}
      <div className="mx-5 mb-2 min-h-[64px]">
        {error ? (
          <p className="text-xs text-red-300" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="text-xs text-white/40 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </p>
        ) : !unlocked ? (
          <p className="text-xs text-white/40 text-center">
            Tap the glowing center to begin.
          </p>
        ) : current ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {current.customerName ?? "Anonymous"}
              </p>
              <p className="text-[10px] text-white/40 font-mono">
                {idx + 1}/{convos.length}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-white/50 line-clamp-1">
              {current.subject ?? "No subject yet"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openRead(current.id)}
                className="rounded-lg border border-white/15 text-white/80 text-sm font-medium py-2"
              >
                Open to read
              </button>
              <button
                type="button"
                onClick={() =>
                  setReply({ text: "", sending: false, error: null, sent: false })
                }
                className="rounded-lg bg-amber-400 text-[#09090B] text-sm font-semibold py-2"
              >
                Reply
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/40">No conversations.</p>
        )}
      </div>

      {/* Info cards */}
      <div className="mx-5 mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold text-amber-300">Guide, don&apos;t overtake</p>
          <p className="mt-1 text-[10px] text-white/45 leading-snug">
            The tools surface options — you make the final call.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold">Critical &amp; Blocked</p>
          <p className="mt-1 text-[10px] text-white/45 leading-snug">
            {criticalCount === 0
              ? `None critical. ${openCount} open, all tracking.`
              : `${criticalCount} need attention.`}
          </p>
        </div>
      </div>

      {/* Bottom nav */}
      {/* Bottom nav — FUNCTIONAL destinations only (founder: no decorative buttons).
          Tasks + Search dropped (no route exists — shipping them would repeat the
          "looks actionable but isn't" problem). */}
      <nav className="flex items-center justify-around border-t border-white/10 px-8 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            setUnlocked(true);
            void load();
          }}
          className="p-2 text-amber-400"
          aria-label="Home / refresh"
        >
          <Home className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => (current ? openRead(current.id) : setUnlocked(true))}
          className="p-2 text-white/50 hover:text-amber-400"
          aria-label="Read current conversation"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setRcdOpen(true)}
          className="p-2 text-white/50 hover:text-amber-400"
          aria-label="Raw Conversation Data"
        >
          <Layers className="w-5 h-5" />
        </button>
        <a
          href="/dashboard/care/settings"
          className="p-2 text-white/50 hover:text-amber-400"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </a>
      </nav>

      {rcdOpen && <RcdMobileSheet onClose={() => setRcdOpen(false)} />}

      {/* Tool result sheet */}
      {sheet && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 flex items-end"
          onClick={() => setSheet(null)}
        >
          <div
            className="w-full max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#111119] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-amber-300">{sheet.label}</p>
              <button
                type="button"
                onClick={() => setSheet(null)}
                aria-label="Close"
                className="p-1 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sheet.loading ? (
              <p className="text-xs text-white/50 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </p>
            ) : sheet.error ? (
              <p className="text-xs text-red-300" role="alert">
                {sheet.error}
              </p>
            ) : (
              <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                {sheet.result}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Reply compose sheet — SAME agent-reply route as desktop (A21/A31). */}
      {reply && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 flex items-end"
          onClick={() => !reply.sending && setReply(null)}
        >
          <div
            className="w-full rounded-t-2xl border-t border-white/10 bg-[#111119] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-amber-300">
                Reply to {current?.customerName ?? "customer"}
              </p>
              <button
                type="button"
                onClick={() => !reply.sending && setReply(null)}
                aria-label="Close"
                className="p-1 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {reply.sent ? (
              <p className="text-sm text-emerald-300">Sent.</p>
            ) : (
              <>
                <textarea
                  value={reply.text}
                  onChange={(e) =>
                    setReply({ ...reply, text: e.target.value })
                  }
                  placeholder="Type your reply…"
                  rows={4}
                  autoFocus
                  className="w-full rounded-lg bg-black/50 border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50 resize-none"
                />
                {reply.error && (
                  <p className="mt-2 text-xs text-red-300" role="alert">
                    {reply.error}
                  </p>
                )}
                {/* Ask Coach — grades the draft on this surface (A16). */}
                <button
                  type="button"
                  onClick={gradeCoach}
                  disabled={!reply.text.trim() || reply.coach?.loading}
                  className="mt-3 w-full rounded-lg border border-amber-400/50 text-amber-300 text-xs font-medium py-2 disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {reply.coach?.loading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  )}
                  <GraduationCap className="w-3.5 h-3.5" aria-hidden /> Ask Coach to check this
                </button>
                {reply.coach && !reply.coach.loading && (
                  <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-3">
                    {reply.coach.error ? (
                      <p className="text-xs text-red-300">{reply.coach.error}</p>
                    ) : reply.coach.suggestion ? (
                      <>
                        <p className="text-[10px] uppercase tracking-widest text-amber-300/70 font-bold mb-1">
                          Coach suggests
                        </p>
                        <p className="text-xs text-white/85 whitespace-pre-wrap leading-relaxed">
                          {reply.coach.suggestion}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setReply((r) =>
                              r ? { ...r, text: r.coach?.suggestion ?? r.text } : r
                            )
                          }
                          className="mt-2 text-[11px] text-amber-300 underline"
                        >
                          Use this
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={reply.sending || !reply.text.trim()}
                  className="mt-3 w-full rounded-lg bg-amber-400 text-[#09090B] text-sm font-semibold py-2.5 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {reply.sending && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  )}
                  Send reply
                </button>
                <p className="mt-2 text-[10px] text-white/40 text-center">
                  The customer sees this. Your AI&apos;s honesty &amp; handoff rules
                  still apply.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Read-messages sheet — makes "Open to read" functional (founder 2026-07-25). */}
      {reading && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 flex items-end"
          onClick={() => setReading(null)}
        >
          <div
            className="w-full max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#111119] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-amber-300">
                {current?.customerName ?? "Conversation"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReading(null);
                    setReply({ text: "", sending: false, error: null, sent: false });
                  }}
                  className="text-xs font-semibold text-[#09090B] bg-amber-400 rounded-full px-3 py-1"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => setReading(null)}
                  aria-label="Close"
                  className="p-1 text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {reading.loading ? (
              <p className="text-xs text-white/50 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </p>
            ) : reading.error ? (
              <p className="text-xs text-red-300" role="alert">
                {reading.error}
              </p>
            ) : reading.messages.length === 0 ? (
              <p className="text-xs text-white/50">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {reading.messages.map((m, i) => (
                  <div
                    key={i}
                    className={m.authorType === "customer" ? "" : "text-right"}
                  >
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">
                      {m.authorType === "customer"
                        ? "Customer"
                        : m.authorType === "ai"
                          ? "AI"
                          : "Agent"}
                    </p>
                    <p
                      className={`inline-block rounded-xl px-3 py-2 text-sm whitespace-pre-wrap text-left ${
                        m.authorType === "customer"
                          ? "bg-white/[0.06] text-white/85"
                          : "bg-amber-400/15 text-white/90"
                      }`}
                    >
                      {m.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
