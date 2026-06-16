"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  ListChecks,
  Loader2,
  Lock,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  StickyNote,
  UserCheck,
} from "lucide-react";
import { careStatusDisplay } from "@/lib/care/statusLabels";
import { priorityDisplay, tagTone } from "@/lib/care/tagColors";
import { useToast } from "@/components/ui/toast";
import { ReadPhasePanel } from "./ReadPhasePanel";
import { ResolutionCaptureModal } from "./ResolutionCaptureModal";
import TaskRefinementPanel from "@/components/tasks/TaskRefinementPanel";
import type { SpawnContextPayload } from "@/lib/taskSpawn/types";

/**
 * ConversationsApp — the Zendesk-shaped master-detail centerpiece.
 *
 * Three panes:
 *   LEFT (260px)  — saved views + search + tag filters
 *   CENTER (flex) — conversation list (selected = sticky highlight)
 *                   AND the detail panel for the selected
 *                   conversation, stacked vertically when wide.
 *   RIGHT (320px) — customer panel + event timeline
 *
 * On narrow screens this collapses to a single-pane stack — list,
 * then detail when one is selected, then customer below.
 *
 * What makes it different from Zendesk
 * ─────────────────────────────────────
 *   - Coach Quality Grade on every agent reply (visible to agent +
 *     leader only; never to the customer)
 *   - AI Co-Pilot drafting button that drafts a reply AND names the
 *     communication move it's making (internal only)
 *   - Spawn Task from conversation (uses the same Task Spawn Engine
 *     that already powers Decision → Task and Chat → Task)
 *   - Spawn Decision Dialogue from conversation (for hard tickets
 *     that need a structured internal call before replying)
 *   - §A11 customer insights: counts and patterns, never verdicts
 *   - §A18 invitation labels for status
 *   - §3.5 honest activity timeline (every state change is on-the-
 *     record)
 */

type Conversation = {
  id: string;
  companyId: string;
  status: string;
  priority: string;
  subject: string | null;
  assignedAgentId: string | null;
  aiResponding: boolean;
  snoozedUntil: string | null;
  slaFirstResponseMinutes: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  tags: Array<{ id: string; name: string; color: string }>;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    lifetimeValue: number | null;
    signupDate: string | null;
    lastSeenAt: string | null;
  } | null;
};

type Message = {
  id: string;
  authorType: "customer" | "ai" | "agent" | "system";
  authorId: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  coachGrade?: "productive" | "neutral" | "needs_guidance" | "withheld" | null;
  coachReasonInternal?: string | null;
};

type ConversationEvent = {
  id: string;
  conversationId: string;
  actorType: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type ViewKey =
  | "mine"
  | "unassigned"
  | "all_open"
  | "snoozed"
  | "resolved"
  | "all";

const VIEWS: Array<{ key: ViewKey; label: string; icon: typeof Inbox }> = [
  { key: "mine", label: "Mine", icon: UserCheck },
  { key: "unassigned", label: "Unassigned", icon: Inbox },
  { key: "all_open", label: "All open", icon: MessageSquare },
  { key: "snoozed", label: "Snoozed", icon: Clock },
  { key: "resolved", label: "Resolved", icon: CheckCircle2 },
  { key: "all", label: "All", icon: Filter },
];

export function ConversationsApp({
  initialId,
}: {
  initialId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const initialView =
    (searchParams.get("view") as ViewKey | null) ?? "all_open";
  const [view, setView] = useState<ViewKey>(initialView);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);

  // Detail state for selected conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  // When the agent invokes the Co-Pilot we capture the original
  // draft so we can later record (draft, sent) into the learning
  // corpus on send.
  const [aiOriginalDraft, setAiOriginalDraft] = useState<string | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [spawnTaskOpen, setSpawnTaskOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Resizable pane widths — list (between views nav and detail)
  // and customer panel (between detail and right edge). Defaults
  // mirror the original Tailwind w-80 (320px). Persisted per-user
  // in localStorage so the layout sticks across sessions, the
  // same way Zendesk / Intercom remember their column widths.
  const [listWidth, setListWidth] = useState<number>(320);
  const [customerWidth, setCustomerWidth] = useState<number>(320);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("care-pane-widths");
      if (raw) {
        const v = JSON.parse(raw) as { list?: number; customer?: number };
        if (typeof v.list === "number") setListWidth(clampPane(v.list, 240, 520));
        if (typeof v.customer === "number")
          setCustomerWidth(clampPane(v.customer, 240, 520));
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "care-pane-widths",
        JSON.stringify({ list: listWidth, customer: customerWidth })
      );
    } catch {
      /* ignore */
    }
  }, [listWidth, customerWidth]);

  // Load identity (so "Mine" filter works) + inbox
  const loadInbox = useCallback(async () => {
    try {
      const [meRes, inboxRes] = await Promise.all([
        fetch("/api/me/identity").catch(() => null),
        fetch("/api/care/agent/inbox?enriched=1"),
      ]);
      if (meRes && meRes.ok) {
        const me = await meRes.json();
        setCurrentUserId(me.userId ?? null);
      }
      if (inboxRes.status === 403) {
        setError("Care is agent-only.");
        return;
      }
      if (!inboxRes.ok) {
        setError("Couldn't load conversations.");
        return;
      }
      const data = await inboxRes.json();
      setConversations(data.conversations ?? []);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  // Lightweight polling so new customer messages + inbox state
  // arrive without a manual refresh. Until S7 wires Supabase
  // realtime channels, a 5s tick is the honest tradeoff: keeps
  // the agent surface live without hammering the API. Pauses when
  // the tab is hidden so background tabs don't burn cycles, and
  // skips refresh while the agent is mid-action so we never
  // clobber the optimistic UI mid-send.
  const actingRef = useRef(false);
  const sendingRef = useRef(false);
  useEffect(() => {
    actingRef.current = acting;
  }, [acting]);
  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (actingRef.current || sendingRef.current) return;
      await loadInbox();
      if (selectedId && !cancelled) {
        try {
          const res = await fetch(
            `/api/care/agent/conversations/${selectedId}`
          );
          if (res.ok) {
            const data = await res.json();
            // Only update if message count actually changed or last
            // message id moved — avoids re-render churn.
            setMessages((prev) => {
              const next: Message[] = data.messages ?? [];
              if (
                prev.length === next.length &&
                prev[prev.length - 1]?.id === next[next.length - 1]?.id
              ) {
                return prev;
              }
              return next;
            });
          }
          const evRes = await fetch(
            `/api/care/agent/conversations/${selectedId}/events`
          );
          if (evRes.ok) {
            const data = await evRes.json();
            setEvents(data.events ?? []);
          }
        } catch {
          /* poll failures are best-effort */
        }
      }
    };
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loadInbox, selectedId]);

  // Apply view + search filters
  const filtered = useMemo(() => {
    if (!conversations) return [];
    let list = conversations;
    switch (view) {
      case "mine":
        list = list.filter(
          (c) =>
            c.assignedAgentId === currentUserId &&
            c.status !== "closed" &&
            c.status !== "resolved"
        );
        break;
      case "unassigned":
        list = list.filter(
          (c) =>
            !c.assignedAgentId &&
            c.status !== "closed" &&
            c.status !== "resolved"
        );
        break;
      case "all_open":
        list = list.filter(
          (c) =>
            c.status === "open" ||
            c.status === "in_conversation" ||
            c.status === "awaiting_customer"
        );
        break;
      case "snoozed":
        list = list.filter(
          (c) =>
            c.snoozedUntil && new Date(c.snoozedUntil).getTime() > Date.now()
        );
        break;
      case "resolved":
        list = list.filter((c) => c.status === "resolved");
        break;
      case "all":
        // no filter
        break;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.subject ?? "").toLowerCase().includes(q) ||
          (c.customer?.email ?? "").toLowerCase().includes(q) ||
          (c.customer?.name ?? "").toLowerCase().includes(q)
      );
    }
    // Sort: priority weight DESC, then last_message_at DESC
    const priorityWeight: Record<string, number> = {
      urgent: 3,
      high: 2,
      normal: 1,
      low: 0,
    };
    return [...list].sort((a, b) => {
      const pw = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
      if (pw !== 0) return pw;
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });
  }, [conversations, view, search, currentUserId]);

  // Counts per view, for the sidebar badges
  const viewCounts = useMemo(() => {
    if (!conversations) {
      return {
        mine: 0,
        unassigned: 0,
        all_open: 0,
        snoozed: 0,
        resolved: 0,
        all: 0,
      };
    }
    return {
      mine: conversations.filter(
        (c) =>
          c.assignedAgentId === currentUserId &&
          c.status !== "closed" &&
          c.status !== "resolved"
      ).length,
      unassigned: conversations.filter(
        (c) =>
          !c.assignedAgentId &&
          c.status !== "closed" &&
          c.status !== "resolved"
      ).length,
      all_open: conversations.filter(
        (c) =>
          c.status === "open" ||
          c.status === "in_conversation" ||
          c.status === "awaiting_customer"
      ).length,
      snoozed: conversations.filter(
        (c) => c.snoozedUntil && new Date(c.snoozedUntil).getTime() > Date.now()
      ).length,
      resolved: conversations.filter((c) => c.status === "resolved").length,
      all: conversations.length,
    } as Record<ViewKey, number>;
  }, [conversations, currentUserId]);

  // Selected conversation
  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  // Auto-select first in view if nothing is selected
  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  // Sync URL with selected id (deep link)
  useEffect(() => {
    if (selectedId) {
      const url = `/dashboard/care/conversations/${selectedId}${
        view !== "all_open" ? `?view=${view}` : ""
      }`;
      router.replace(url, { scroll: false });
    }
  }, [selectedId, view, router]);

  // Load detail (messages + events) for selected conversation
  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const [convRes, evRes] = await Promise.all([
        fetch(`/api/care/agent/conversations/${id}`),
        fetch(`/api/care/agent/conversations/${id}/events`),
      ]);
      if (convRes.ok) {
        const data = await convRes.json();
        setMessages(data.messages ?? []);
      }
      if (evRes.ok) {
        const data = await evRes.json();
        setEvents(data.events ?? []);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  // Auto-scroll message stream on new
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Keyboard shortcuts: J/K navigate, R reply, N internal note, E resolve
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (!filtered.length) return;
      const idx = selectedId
        ? filtered.findIndex((c) => c.id === selectedId)
        : 0;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = filtered[Math.min(idx + 1, filtered.length - 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = filtered[Math.max(idx - 1, 0)];
        if (prev) setSelectedId(prev.id);
      } else if (e.key === "r" && selected) {
        e.preventDefault();
        setIsInternalNote(false);
        composerRef.current?.focus();
      } else if (e.key === "n" && selected) {
        e.preventDefault();
        setIsInternalNote(true);
        composerRef.current?.focus();
      } else if (e.key === "e" && selected) {
        e.preventDefault();
        // E opens the capture modal — §1.1 discipline routes the
        // resolve action through the learning capture.
        setResolveModalOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedId, selected]);

  // Shared action runner. Sends the PATCH, surfaces failure to
  // the agent (no more silent "ok=true but nothing changed"), and
  // verifies the returned conversation state matches what we
  // asked for. The verification is the §1.6 close-the-loop move
  // in code: a confirmed action means the DB row IS in the
  // expected state, not just that the API returned 200.
  const runAction = async (
    body: Record<string, unknown>,
    expect: { status?: string; priority?: string; claimed?: boolean } | null,
    successMsg: string
  ): Promise<boolean> => {
    if (!selected) return false;
    setActing(true);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(
          data?.error
            ? `Couldn't apply change — ${data.error}`
            : "Couldn't apply change. Please try again."
        );
        return false;
      }
      // Divergence detection. The API gives us the post-action
      // conversation row; if the state doesn't match expectation,
      // the action SAID it worked but the DB disagrees. Surface
      // it instead of silently moving on.
      const fresh = data?.conversation as Conversation | undefined;
      if (fresh && expect) {
        if (expect.status && fresh.status !== expect.status) {
          toast.error(
            `Action reported success but conversation is still "${fresh.status}". This usually means a permission or trigger rejected the write — check RLS for support_conversations.`
          );
          await loadInbox();
          await loadDetail(selected.id);
          return false;
        }
        if (expect.priority && fresh.priority !== expect.priority) {
          toast.error(
            `Priority change didn't stick — DB still reads "${fresh.priority}".`
          );
          await loadInbox();
          await loadDetail(selected.id);
          return false;
        }
        if (
          expect.claimed &&
          fresh.assignedAgentId !== currentUserId
        ) {
          toast.error("Claim didn't stick — conversation is still unassigned.");
          await loadInbox();
          await loadDetail(selected.id);
          return false;
        }
      }
      toast.success(successMsg);
      await loadInbox();
      await loadDetail(selected.id);
      return true;
    } catch {
      toast.error("Couldn't reach the server.");
      return false;
    } finally {
      setActing(false);
    }
  };

  const claim = async () => {
    await runAction({ action: "claim" }, { claimed: true }, "Claimed.");
  };

  const changeStatus = async (
    next: "in_conversation" | "awaiting_customer" | "resolved" | "closed"
  ) => {
    await runAction(
      { action: "status", status: next },
      { status: next },
      `Marked as ${careStatusDisplay(next).label}`
    );
  };

  const setPriority = async (priority: string) => {
    await runAction(
      { action: "priority", priority },
      { priority },
      `Priority set to ${priority}.`
    );
  };

  const send = async () => {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${selected.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: draft,
            isInternalNote,
            // Pass the Co-Pilot context if this reply originated
            // from a Co-Pilot draft. Server captures the diff into
            // the learning corpus.
            aiDraft:
              !isInternalNote && aiOriginalDraft ? aiOriginalDraft : undefined,
            aiReasoning:
              !isInternalNote && aiOriginalDraft ? aiReasoning : undefined,
          }),
        }
      );
      if (res.ok) {
        setDraft("");
        // Clear the Co-Pilot context once sent so the next reply
        // captures fresh.
        setAiOriginalDraft(null);
        setAiReasoning(null);
        await loadDetail(selected.id);
        await loadInbox();
      } else {
        toast.error("Couldn't send.");
      }
    } finally {
      setSending(false);
    }
  };

  const askAiCoPilot = async () => {
    if (!selected || aiDrafting) return;
    setAiDrafting(true);
    setAiReasoning(null);
    setAiOriginalDraft(null);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${selected.id}/co-pilot`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        const draftText = data.draft ?? "";
        setDraft(draftText);
        setAiOriginalDraft(draftText);
        setIsInternalNote(false);
        if (data.reasoning) setAiReasoning(data.reasoning);
        composerRef.current?.focus();
      } else {
        toast.error("Co-pilot couldn't draft.");
      }
    } finally {
      setAiDrafting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* LEFT — Views + search + tag filters */}
      <aside className="w-60 flex-shrink-0 border-r border-default bg-white/[0.01] flex flex-col">
        <div className="px-4 py-3 border-b border-default">
          <h2 className="text-sm font-semibold text-primary">Conversations</h2>
        </div>
        <div className="px-3 py-3 space-y-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            const count = viewCounts[v.key];
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#FACC15]/10 text-brand"
                    : "text-secondary hover:text-primary hover:bg-white/[0.03]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{v.label}</span>
                <span className="text-[10px] font-mono text-muted">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Help footer */}
        <div className="mt-auto px-4 py-3 border-t border-default">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">
            Keys
          </p>
          <p className="text-[10px] text-muted font-mono leading-relaxed">
            J/K navigate · R reply · N note · E resolve
          </p>
        </div>
      </aside>

      {/* CENTER — List + detail */}
      <div className="flex flex-1 min-w-0 min-h-0">
        {/* List pane */}
        <div
          style={{ width: listWidth }}
          className="flex-shrink-0 border-r border-default flex flex-col"
        >
          {/* Search */}
          <div className="px-3 py-2 border-b border-default">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject, email, name…"
                className="w-full bg-base border border-default rounded-md pl-7 pr-2 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-strong"
              />
            </div>
          </div>

          {error ? (
            <div className="p-4 text-xs text-red-300">{error}</div>
          ) : !conversations ? (
            <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-muted">
              {search
                ? "No matches."
                : "Nothing in this view."}
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-default">
              {filtered.map((c) => (
                <ConversationListRow
                  key={c.id}
                  conversation={c}
                  selected={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <PaneSplitter
          onDrag={(dx) =>
            setListWidth((w) => clampPane(w + dx, 240, 520))
          }
          ariaLabel="Resize conversation list"
        />

        {/* Detail pane */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center px-8">
              <div>
                <Inbox
                  className="w-10 h-10 text-muted mx-auto mb-3"
                  aria-hidden
                />
                <p className="text-sm text-primary mb-1 font-medium">
                  Select a conversation
                </p>
                <p className="text-xs text-muted max-w-sm">
                  Pick one from the list, or use J/K to navigate.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <DetailHeader
                conversation={selected}
                acting={acting}
                onClaim={claim}
                onResolve={() => setResolveModalOpen(true)}
                onClose={() => {
                  // Close = terminal state without a resolution
                  // capture. Confirmable because §1.6 prefers
                  // Resolve (which captures learning); Close is
                  // for the "this isn't actually a conversation"
                  // path (spam, accidental click, dup).
                  if (
                    window.confirm(
                      "Close this conversation without capturing a resolution? Use Resolve instead if there's a learning to record."
                    )
                  ) {
                    void changeStatus("closed");
                  }
                }}
                onPriorityChange={setPriority}
              />

              {/* The Read Phase — §0 Understanding Gate */}
              <ReadPhasePanel
                conversationId={selected.id}
                onReadComplete={() => void loadInbox()}
              />

              {/* Message stream */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-8 py-5 space-y-3 bg-white/[0.01]"
              >
                {detailLoading && messages.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading…
                  </div>
                )}
                {messages.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
              </div>

              {/* Composer */}
              {selected.status !== "closed" && (
                <Composer
                  draft={draft}
                  onDraftChange={setDraft}
                  isInternalNote={isInternalNote}
                  onToggleNote={setIsInternalNote}
                  onSend={send}
                  sending={sending}
                  onAiCoPilot={askAiCoPilot}
                  aiDrafting={aiDrafting}
                  aiReasoning={aiReasoning}
                  composerRef={composerRef}
                  conversationId={selected.id}
                  onSpawnTask={() => setSpawnTaskOpen(true)}
                />
              )}
            </>
          )}
        </div>

        {/* RIGHT — Customer panel + timeline */}
        {selected && (
          <>
            <PaneSplitter
              onDrag={(dx) =>
                setCustomerWidth((w) => clampPane(w - dx, 240, 520))
              }
              ariaLabel="Resize customer panel"
            />
            <CustomerPanel
              conversation={selected}
              events={events}
              width={customerWidth}
            />
          </>
        )}
      </div>

      {/* Resolution capture modal — opens when the agent hits
          "Resolve". Captures the §1.1 learning before the status
          actually flips. The modal's "Capture & resolve" button
          handles both: insert resolution + mark conversation
          resolved (the trigger from 0036 then schedules the
          7-day durability check). */}
      {selected && (
        <ResolutionCaptureModal
          conversationId={selected.id}
          open={resolveModalOpen}
          onClose={() => setResolveModalOpen(false)}
          onCaptured={() => {
            void loadInbox();
            void loadDetail(selected.id);
          }}
        />
      )}

      {/* Task spawn — wires to the existing Task Spawn Engine that
          already powers Decision → Task and Chat → Task. Care
          conversations map cleanly onto the chat_messages shape:
          subject as title, all customer + agent messages as the
          selected message thread. The §1.6 close-the-loop move
          from support: a customer asking for something becomes a
          structured internal task with steps, not an item lost in
          a sea of tickets. */}
      {selected && spawnTaskOpen && (
        <TaskRefinementPanel
          open={spawnTaskOpen}
          onClose={() => setSpawnTaskOpen(false)}
          contextType="chat_messages"
          contextPayload={
            {
              chatTopicId: selected.id,
              chatTopicTitle: selected.subject ?? "Customer conversation",
              chatTopicDescription:
                selected.customer?.email
                  ? `Customer: ${selected.customer.name ?? selected.customer.email}`
                  : "Anonymous customer",
              selectedMessageIds: messages.map((m) => m.id),
              selectedMessages: messages
                .filter((m) => !m.isInternalNote && m.authorType !== "system")
                .map((m) => ({
                  author:
                    m.authorType === "customer"
                      ? "Customer"
                      : m.authorType === "agent"
                        ? "Agent"
                        : "AI",
                  body: m.body,
                })),
            } satisfies SpawnContextPayload
          }
          onSaved={() => {
            toast.success(
              "Task created",
              "Spawned from this conversation — find it in Tasks."
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Pieces ────────────────────────────────────────────────────

function ConversationListRow({
  conversation: c,
  selected,
  onClick,
}: {
  conversation: Conversation;
  selected: boolean;
  onClick: () => void;
}) {
  const dl = careStatusDisplay(c.status);
  const pri = priorityDisplay(c.priority);
  const Icon = dl.icon;
  const slaPct = computeSlaPct(c);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left px-3 py-2.5 transition-colors flex items-start gap-2.5 ${
          selected
            ? "bg-[#FACC15]/[0.06] border-l-2 border-[#FACC15]"
            : "hover:bg-white/[0.02] border-l-2 border-transparent"
        }`}
      >
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full ${pri.tone.dot}`}
            title={pri.label}
          />
          <Icon className={`w-3.5 h-3.5 ${dl.tone.text}`} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-xs font-semibold text-primary truncate">
              {c.customer?.name ?? c.customer?.email ?? "Anonymous"}
            </p>
            <p className="text-[10px] text-muted font-mono shrink-0">
              {relativeShort(c.lastMessageAt)}
            </p>
          </div>
          <p className="text-xs text-secondary truncate leading-tight">
            {c.subject ?? "Untitled"}
          </p>
          {c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {c.tags.slice(0, 3).map((t) => {
                const tone = tagTone(t.color);
                return (
                  <span
                    key={t.id}
                    className={`text-[9px] uppercase tracking-widest font-bold px-1 py-0.5 rounded border ${tone.chip}`}
                  >
                    {t.name}
                  </span>
                );
              })}
            </div>
          )}
          {slaPct !== null && slaPct < 100 && (
            <div className="mt-1.5 h-0.5 rounded-full bg-surface overflow-hidden">
              <div
                className={`h-full transition-all ${
                  slaPct >= 90
                    ? "bg-red-500"
                    : slaPct >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, slaPct)}%` }}
              />
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

function DetailHeader({
  conversation,
  acting,
  onClaim,
  onResolve,
  onClose,
  onPriorityChange,
}: {
  conversation: Conversation;
  acting: boolean;
  onClaim: () => void;
  onResolve: () => void;
  onClose: () => void;
  onPriorityChange: (priority: string) => void;
}) {
  const dl = careStatusDisplay(conversation.status);
  const Icon = dl.icon;
  return (
    <div className="border-b border-default px-6 py-3 bg-base/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-primary truncate">
            {conversation.subject ?? "Untitled conversation"}
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${dl.tone.border} ${dl.tone.bg} ${dl.tone.text}`}
            >
              <Icon className="w-3 h-3" aria-hidden />
              {dl.label}
            </span>
            {conversation.aiResponding && (
              <span className="inline-flex items-center gap-1 text-[10px] text-arc-300">
                <Sparkles className="w-3 h-3" aria-hidden />
                AI responding
              </span>
            )}
            <PriorityDropdown
              current={conversation.priority}
              onChange={onPriorityChange}
            />
            {conversation.tags.map((t) => {
              const tone = tagTone(t.color);
              return (
                <span
                  key={t.id}
                  className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${tone.chip}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                  {t.name}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {conversation.aiResponding && (
            <button
              type="button"
              onClick={onClaim}
              disabled={acting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-[#FACC15]/10 border border-[#FACC15]/40 hover:border-[#FACC15]/70 hover:bg-[#FACC15]/15 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              <UserCheck className="w-3.5 h-3.5" aria-hidden />
              Take over
            </button>
          )}
          {conversation.status !== "resolved" &&
            conversation.status !== "closed" && (
              <button
                type="button"
                onClick={onResolve}
                disabled={acting}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 disabled:opacity-50 px-3 py-1.5 rounded-md"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                Resolve
              </button>
            )}
          {conversation.status !== "closed" && (
            <button
              type="button"
              onClick={onClose}
              disabled={acting}
              title="Close without capturing a resolution"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary border border-default hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/5 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden />
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PriorityDropdown({
  current,
  onChange,
}: {
  current: string;
  onChange: (p: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = priorityDisplay(current);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${cur.tone.chip}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cur.tone.dot}`} />
        {cur.label}
      </button>
      {open && (
        <div
          className="absolute z-10 mt-1 left-0 bg-base border border-default rounded-md shadow-lg py-1 min-w-[120px]"
          onMouseLeave={() => setOpen(false)}
        >
          {(["urgent", "high", "normal", "low"] as const).map((p) => {
            const d = priorityDisplay(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1 text-[11px] hover:bg-white/[0.04] flex items-center gap-1.5"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${d.tone.dot}`} />
                {d.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  const isCustomer = message.authorType === "customer";
  const isAi = message.authorType === "ai";
  const isAgent = message.authorType === "agent";
  const isNote = message.isInternalNote;

  if (message.authorType === "system") {
    return (
      <div className="text-center text-[10px] text-muted italic py-1">
        {message.body}
      </div>
    );
  }

  const speaker = isCustomer
    ? "Customer"
    : isAi
      ? "AI"
      : isAgent
        ? "You"
        : "System";

  const tone = isNote
    ? "border-accent-text/30 bg-accent-text/[0.04]"
    : isCustomer
      ? "border-default bg-white/[0.02]"
      : isAi
        ? "border-arc-400/30 bg-arc-400/[0.04]"
        : "border-[#FACC15]/30 bg-[#FACC15]/[0.04]";

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
          {speaker}
        </span>
        {isNote && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-accent-text">
            <StickyNote className="w-2.5 h-2.5" aria-hidden /> Internal note
          </span>
        )}
        <span className="text-[10px] text-muted font-mono ml-auto">
          {new Date(message.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
        {message.body}
      </p>
      {/* Coach grade — only on agent public replies; visible to
          agent + leader, never to the customer. Until the async
          grader returns we show "grading..."; after that the real
          grade and short internal reason render. §A18: labels
          invite reflection (Productive / Neutral / Needs guidance),
          never blame. */}
      {isAgent && !isNote && (
        <div className="mt-2 pt-2 border-t border-[#FACC15]/20 flex items-start gap-2">
          {message.coachGrade ? (
            <>
              <Sparkles
                className={`w-3 h-3 shrink-0 mt-0.5 ${
                  message.coachGrade === "productive"
                    ? "text-emerald-300"
                    : message.coachGrade === "needs_guidance"
                      ? "text-amber-300"
                      : "text-secondary"
                }`}
                aria-hidden
              />
              <div className="flex-1">
                <span
                  className={`text-[10px] uppercase tracking-widest font-bold ${
                    message.coachGrade === "productive"
                      ? "text-emerald-300"
                      : message.coachGrade === "needs_guidance"
                        ? "text-amber-300"
                        : "text-muted"
                  }`}
                >
                  Coach:{" "}
                  {message.coachGrade === "needs_guidance"
                    ? "needs guidance"
                    : message.coachGrade}
                </span>
                {message.coachReasonInternal && (
                  <p className="text-[10px] text-secondary leading-relaxed mt-0.5 italic">
                    {message.coachReasonInternal}
                  </p>
                )}
              </div>
            </>
          ) : (
            <span className="text-[10px] text-muted italic">
              Coach is reading…
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Composer({
  draft,
  onDraftChange,
  isInternalNote,
  onToggleNote,
  onSend,
  sending,
  onAiCoPilot,
  aiDrafting,
  aiReasoning,
  composerRef,
  onSpawnTask,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  isInternalNote: boolean;
  onToggleNote: (v: boolean) => void;
  onSend: () => void;
  sending: boolean;
  onAiCoPilot: () => void;
  aiDrafting: boolean;
  aiReasoning: string | null;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  conversationId: string;
  onSpawnTask: () => void;
}) {
  return (
    <div className="border-t border-default bg-white/[0.02] px-6 py-3">
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <button
          type="button"
          onClick={() => onToggleNote(false)}
          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
            !isInternalNote
              ? "text-brand border-[#FACC15]/40 bg-[#FACC15]/10"
              : "text-muted border-default hover:border-strong"
          }`}
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => onToggleNote(true)}
          className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
            isInternalNote
              ? "text-accent-text border-accent-text/40 bg-accent-text/10"
              : "text-muted border-default hover:border-strong"
          }`}
        >
          <StickyNote className="w-3 h-3" aria-hidden />
          Internal note
        </button>
        <div className="flex-1" />
        {!isInternalNote && (
          <>
            <button
              type="button"
              onClick={onAiCoPilot}
              disabled={aiDrafting}
              title="Draft a reply using the Coach's communication discipline + the company's past resolutions"
              className="text-[11px] font-semibold text-brand border border-[#FACC15]/40 hover:border-[#FACC15]/70 bg-[#FACC15]/5 hover:bg-[#FACC15]/10 disabled:opacity-50 inline-flex items-center gap-1 px-2 py-0.5 rounded"
            >
              {aiDrafting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" aria-hidden />
              )}
              AI Co-pilot
            </button>
            <button
              type="button"
              onClick={onSpawnTask}
              title="Turn this conversation into a structured task — uses the same Task Spawn Engine as Decision Dialogue"
              className="text-[11px] font-semibold text-arc-300 border border-arc-400/40 hover:border-arc-400/70 bg-arc-400/5 hover:bg-arc-400/10 inline-flex items-center gap-1 px-2 py-0.5 rounded"
            >
              <ListChecks className="w-3 h-3" aria-hidden />
              Spawn task
            </button>
          </>
        )}
      </div>
      {aiReasoning && (
        <div className="mb-2 p-2 rounded-md border border-arc-400/30 bg-arc-400/[0.04] text-[11px] text-arc-300 leading-relaxed">
          <span className="font-semibold">Co-pilot reasoning (internal):</span>{" "}
          {aiReasoning}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={
            isInternalNote
              ? "Internal note — agent-only, customer never sees this…"
              : "Type your reply…"
          }
          rows={3}
          disabled={sending}
          className={`flex-1 min-w-0 bg-base border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none resize-y leading-relaxed ${
            isInternalNote
              ? "border-accent-text/30 focus:border-accent-text/50"
              : "border-default focus:border-strong"
          }`}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !draft.trim()}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-[#09090B] px-3 py-2 rounded-md"
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send
        </button>
      </div>
      <p className="text-[10px] text-muted mt-1.5">
        Cmd/Ctrl+Enter to send · {isInternalNote ? "Note stays internal." : "Customer sees this on the widget."}
      </p>
    </div>
  );
}

function CustomerPanel({
  conversation,
  events,
  width,
}: {
  conversation: Conversation;
  events: ConversationEvent[];
  width: number;
}) {
  const customer = conversation.customer;
  return (
    <aside
      style={{ width }}
      className="flex-shrink-0 border-l border-default bg-white/[0.01] flex flex-col"
    >
      <div className="px-5 py-4 border-b border-default">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">
          Customer
        </p>
        <p className="text-sm font-semibold text-primary mb-0.5">
          {customer?.name ?? customer?.email ?? "Anonymous visitor"}
        </p>
        {customer?.email && (
          <p className="text-xs text-secondary truncate">{customer.email}</p>
        )}
        {customer?.phone && (
          <p className="text-xs text-secondary">{customer.phone}</p>
        )}
      </div>

      {customer && (
        <div className="px-5 py-3 border-b border-default space-y-1.5">
          {customer.signupDate && (
            <CustomerStat
              label="Customer since"
              value={customer.signupDate}
            />
          )}
          {customer.lifetimeValue != null && (
            <CustomerStat
              label="Lifetime value"
              value={`$${customer.lifetimeValue.toLocaleString()}`}
            />
          )}
          {customer.lastSeenAt && (
            <CustomerStat
              label="Last seen"
              value={relativeShort(customer.lastSeenAt)}
            />
          )}
        </div>
      )}

      {/* §A11 mirror panel — counts and patterns the System has
          observed about this customer. Never verdicts. The data
          source is the customer's full conversation history
          (Sprint 3c wires this to a real aggregator). */}
      <div className="px-5 py-3 border-b border-default">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
          What we&apos;ve noticed
        </p>
        <p className="text-[11px] text-secondary leading-relaxed italic">
          We need a few more conversations with this customer before
          surfacing patterns. The System refuses to assert about
          someone it hasn&apos;t observed enough.
        </p>
      </div>

      {/* Activity timeline */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
          Activity
        </p>
        {events.length === 0 ? (
          <p className="text-[11px] text-muted italic">No events yet.</p>
        ) : (
          <ul className="space-y-2 border-l border-default pl-3">
            {events
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  <p className="text-[11px] text-primary leading-tight">
                    {renderEventLabel(e)}
                  </p>
                  <p className="text-[10px] text-muted font-mono">
                    {new Date(e.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function CustomerStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="text-primary font-medium">{value}</span>
    </div>
  );
}

function renderEventLabel(e: ConversationEvent): string {
  switch (e.eventType) {
    case "claimed":
      return "Agent took over";
    case "unassigned":
      return "Unassigned";
    case "status_changed":
      return `Status: ${(e.metadata.from as string) ?? "?"} → ${(e.metadata.to as string) ?? "?"}`;
    case "priority_changed":
      return `Priority: ${(e.metadata.from as string) ?? "?"} → ${(e.metadata.to as string) ?? "?"}`;
    case "tag_added":
      return `Tag added: ${(e.metadata.tag_name as string) ?? "?"}`;
    case "tag_removed":
      return `Tag removed: ${(e.metadata.tag_name as string) ?? "?"}`;
    case "snoozed":
      return `Snoozed until ${e.metadata.until ? new Date(e.metadata.until as string).toLocaleString() : "?"}`;
    case "unsnoozed":
      return "Unsnoozed";
    default:
      return e.eventType;
  }
}

function relativeShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toISOString().slice(5, 10);
}

function computeSlaPct(c: Conversation): number | null {
  // FRT only — Once first_response_at lands, the SLA's done.
  if (c.firstResponseAt) return null;
  if (!c.firstMessageAt) return null;
  const elapsed = Date.now() - new Date(c.firstMessageAt).getTime();
  const target = c.slaFirstResponseMinutes * 60_000;
  return Math.round((elapsed / target) * 100);
}

// ─── Layout helpers ─────────────────────────────────────────────

function clampPane(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// A 4px draggable splitter. Reports drag delta (px) to the parent
// which decides which adjacent pane shrinks/grows. Keeping the
// split-direction policy in the parent means the same component
// works for both the left split (list → grow right) and the
// right split (customer → grow left, hence the inverted dx).
function PaneSplitter({
  onDrag,
  ariaLabel,
}: {
  onDrag: (deltaX: number) => void;
  ariaLabel: string;
}) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      if (dx !== 0) onDrag(dx);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
      className="w-1 flex-shrink-0 bg-default/40 hover:bg-[#FACC15]/40 active:bg-[#FACC15]/60 cursor-col-resize transition-colors"
    />
  );
}
