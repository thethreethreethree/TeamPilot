"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  CheckCircle2,
  Clock,
  Filter,
  Archive,
  Inbox,
  Lightbulb,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  StickyNote,
  UserCheck,
  Wand2,
  X,
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
  /** Channel the conversation arrived through. Used to render
   *  a per-conversation channel badge + (for email) signal to
   *  the agent that their reply will dispatch as outbound email. */
  source?: "web_widget" | "embedded_widget" | "email" | string | null;
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

type CoachCounts = {
  positive: {
    acknowledged: 0 | 1;
    answered: 0 | 1;
    next_step: 0 | 1;
  };
  risks: {
    unsupported_absolutes: number;
    fabricated_specifics: number;
    empty_filler: number;
  };
  reason_internal: string;
};

type Message = {
  id: string;
  authorType: "customer" | "ai" | "agent" | "system";
  authorId: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  /** v5 back-compat enum. */
  coachGrade?: "productive" | "neutral" | "needs_guidance" | "withheld" | null;
  coachReasonInternal?: string | null;
  /** Coach v6 count-based output. New UI reads this; v5 enum
   *  is fallback for messages graded before migration 0040. */
  coachCounts?: CoachCounts | null;
  /** A16 direction 2 — the Co-Pilot's reasoning when this
   *  message was Co-Pilot-drafted. Shown in the timeline as
   *  "AI drafted; reasoning: ..." for agent visibility. */
  coPilotReasoning?: string | null;
  coPilotInvoked?: boolean;
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
  | "closed"
  | "all";

const VIEWS: Array<{ key: ViewKey; label: string; icon: typeof Inbox }> = [
  { key: "mine", label: "Mine", icon: UserCheck },
  { key: "unassigned", label: "Unassigned", icon: Inbox },
  { key: "all_open", label: "All open", icon: MessageSquare },
  { key: "snoozed", label: "Snoozed", icon: Clock },
  { key: "resolved", label: "Resolved", icon: CheckCircle2 },
  // 2026-06-17 — Closed folder added per user request. Schema
  // already supports status='closed' (migration 0034). Closed
  // conversations are archived: no further activity expected,
  // distinct from 'resolved' which is "agent marked done but
  // could still reopen." Closed lives outside All open / Resolved
  // so an inbox that scrolls forever doesn't drown the active
  // work.
  { key: "closed", label: "Closed", icon: Archive },
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
  // Caller's role — drives admin-only affordances (frictionless
  // Close on stale conversations, future admin overrides).
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  // Team roster — loaded once for the Assign dropdown in the
  // conversation header. Refreshing on every conversation switch
  // is wasteful; team membership rarely changes mid-session.
  const [team, setTeam] = useState<
    Array<{ id: string; fullName: string | null; role: string | null; isSupportAgent: boolean }>
  >([]);
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
  // Phase 8 (chat-tools port) — four agent helpers on the
  // conversation surface. State lives here so the modals can
  // render at the top level and the buttons can live in
  // DetailHeader / Composer via props.
  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [formulateOpen, setFormulateOpen] = useState(false);
  const [askCoachOpen, setAskCoachOpen] = useState(false);
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
        setCurrentUserRole(me.role ?? null);
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

  // One-time team roster fetch — drives the Assign dropdown.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/care/agent/team");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTeam(data.agents ?? []);
      } catch {
        /* non-fatal — assign dropdown just won't have options */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      case "closed":
        list = list.filter((c) => c.status === "closed");
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
        closed: 0,
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
      closed: conversations.filter((c) => c.status === "closed").length,
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

  const assignTo = async (targetAgentId: string | null) => {
    await runAction(
      { action: "assign", targetAgentId },
      null,
      targetAgentId ? "Assigned." : "Unassigned."
    );
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
                team={team}
                currentUserId={currentUserId}
                isAdmin={
                  currentUserRole === "CEO" ||
                  currentUserRole === "COO" ||
                  currentUserRole === "admin"
                }
                onClaim={claim}
                onAssign={assignTo}
                onSummarize={() => setSummarizeOpen(true)}
                onResolve={() => setResolveModalOpen(true)}
                onClose={() => {
                  // Close = terminal state without a resolution
                  // capture. Confirmable for regular agents
                  // because §1.6 prefers Resolve (which captures
                  // learning); Close is for the "this isn't
                  // actually a conversation" path (spam,
                  // accidental click, dup, anonymous abandon).
                  //
                  // 2026-06-17 — admins skip the confirm. User
                  // flagged the friction on an anonymous
                  // awaiting_customer conversation that would
                  // otherwise sit in the inbox forever if the
                  // visitor never returns. Admins need a clean
                  // close path; the warning is for agents.
                  const isAdmin =
                    currentUserRole === "CEO" ||
                    currentUserRole === "COO" ||
                    currentUserRole === "admin";
                  if (isAdmin) {
                    void changeStatus("closed");
                    return;
                  }
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
                  <MessageRow
                    key={m.id}
                    message={m}
                    onAskCoPilot={askAiCoPilot}
                    composerRef={composerRef}
                  />
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
                  onFormulate={() => setFormulateOpen(true)}
                  onAskCoach={() => setAskCoachOpen(true)}
                  isEmailChannel={selected.source === "email"}
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

      {/* Phase 8 chat-tools port — three agent helpers as
          slide-out / modal surfaces. Each renders only when
          its toggle is open AND a conversation is selected. */}
      {selected && summarizeOpen && (
        <SummarizeCarePanel
          conversationId={selected.id}
          onClose={() => setSummarizeOpen(false)}
        />
      )}
      {selected && formulateOpen && (
        <FormulateCarePanel
          conversationId={selected.id}
          onClose={() => setFormulateOpen(false)}
          onApply={(draftText) => {
            setDraft(draftText);
            setFormulateOpen(false);
            composerRef.current?.focus();
          }}
        />
      )}
      {selected && askCoachOpen && (
        <AskCoachCarePanel
          conversationId={selected.id}
          draft={draft}
          coPilotReasoning={aiReasoning}
          onClose={() => setAskCoachOpen(false)}
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
  team,
  currentUserId,
  isAdmin,
  onClaim,
  onAssign,
  onResolve,
  onClose,
  onPriorityChange,
  onSummarize,
}: {
  conversation: Conversation;
  acting: boolean;
  team: Array<{
    id: string;
    fullName: string | null;
    role: string | null;
    isSupportAgent: boolean;
  }>;
  currentUserId: string | null;
  isAdmin: boolean;
  onClaim: () => void;
  onAssign: (targetAgentId: string | null) => void;
  onResolve: () => void;
  onClose: () => void;
  onPriorityChange: (priority: string) => void;
  onSummarize: () => void;
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
            {/* Channel badge — Phase 4. Email surfaces with a
                distinct chip so the agent knows their reply will
                dispatch as outbound email. */}
            {conversation.source === "email" && (
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-arc-400/40 bg-arc-400/10 text-arc-300"
                title="This conversation arrived via email. Replies will be dispatched as outbound email."
              >
                <Mail className="w-3 h-3" aria-hidden />
                Email
              </span>
            )}
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
        <div className="flex items-center gap-1.5 flex-wrap justify-end gap-y-2 relative z-10 max-w-full">
          {/* Summarize — System's read of the thread for an agent
              taking over a long conversation. Always available;
              the endpoint says "no messages yet" if there's
              nothing to summarize.

              2026-06-17 — row now wraps and has z-index. User
              reported "Close button not working" — Customer
              panel column was overlapping the buttons at
              certain viewports, and overflow-visible meant
              buttons spilled into the right panel's stacking
              context, making them visually present but
              click-blocked by the panel underneath. Wrap +
              z-10 keeps every button reachable. */}
          <button
            type="button"
            onClick={onSummarize}
            disabled={acting}
            title="Get the System's read of this conversation so far"
            className="inline-flex items-center gap-1.5 text-xs text-arc-300 border border-arc-400/40 hover:border-arc-400/70 disabled:opacity-50 px-3 py-1.5 rounded-md"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Summarize
          </button>
          {/* Open as Decision Dialogue — escalates a tough
              customer case to the §3.1 structured internal call.
              For v1 routes to /dashboard/decisions/new with the
              conversation context as the seed; full inline-in-
              thread integration is queued for a follow-up. */}
          {conversation.status !== "closed" && (
            <Link
              href={`/dashboard/decisions/new?fromCareConversation=${conversation.id}`}
              title="Open this as a structured internal Decision Dialogue"
              className="inline-flex items-center gap-1.5 text-xs text-brand border border-[#FACC15]/40 hover:border-[#FACC15]/70 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              <Brain className="w-3.5 h-3.5" aria-hidden />
              Open as Decision Dialogue
            </Link>
          )}
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
          {/* Assign dropdown — always visible when there's a team
              to assign to. Take over (above) is a shortcut for
              "claim it myself"; Assign is "specifically hand it
              to X." Both make sense whether AI is currently
              responding or already claimed. Permission gate on
              the route side enforces who can reassign whose
              conversation (admins anyone's, agents only their
              own). */}
          {team.length > 0 && (
            <AssignDropdown
              team={team}
              currentAssignedId={conversation.assignedAgentId}
              currentUserId={currentUserId}
              acting={acting}
              onAssign={onAssign}
            />
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
              title={
                isAdmin
                  ? "Force close — admin override (no confirmation)"
                  : "Close without capturing a resolution"
              }
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

function AssignDropdown({
  team,
  currentAssignedId,
  currentUserId,
  acting,
  onAssign,
}: {
  team: Array<{
    id: string;
    fullName: string | null;
    role: string | null;
    isSupportAgent: boolean;
  }>;
  currentAssignedId: string | null;
  currentUserId: string | null;
  acting: boolean;
  onAssign: (targetAgentId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [open]);
  const current = team.find((t) => t.id === currentAssignedId);
  const label = current?.fullName ?? "Assign";
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={acting}
        title="Assign or hand off this conversation"
        className="inline-flex items-center gap-1.5 text-xs text-secondary border border-default hover:text-arc-300 hover:border-arc-400/50 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
      >
        <UserCheck className="w-3.5 h-3.5" aria-hidden />
        {current ? `Assigned: ${label}` : "Assign"}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 max-h-80 overflow-y-auto bg-base border border-default rounded-md shadow-lg z-30 py-1">
          {currentAssignedId && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAssign(null);
              }}
              className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/5"
            >
              ↶ Unassign (return to Unassigned)
            </button>
          )}
          {team.map((t) => {
            const isCurrent = t.id === currentAssignedId;
            const isMe = t.id === currentUserId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (!isCurrent) onAssign(t.id);
                }}
                disabled={isCurrent}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                  isCurrent
                    ? "bg-arc-400/5 text-arc-300 cursor-default"
                    : "text-primary hover:bg-base/40"
                }`}
              >
                <span className="truncate">
                  {t.fullName ?? "(unnamed)"}
                  {isMe && (
                    <span className="text-muted ml-1.5 text-[10px]">
                      (you)
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted uppercase tracking-widest shrink-0">
                  {t.role ?? (t.isSupportAgent ? "agent" : "")}
                </span>
              </button>
            );
          })}
        </div>
      )}
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

function MessageRow({
  message,
  onAskCoPilot,
  composerRef,
}: {
  message: Message;
  onAskCoPilot?: () => void;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
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
      {/* Coach v6 — count-based render. §A11: the System counts;
          the agent renders the verdict. §A17: three contracts —
          positive counts (what's present, surfaced FIRST per the
          experiential contract), risk counts (what's flagged for
          consideration), reason (internal context). §A18: the
          label IS the counts — no verdict adjective for a leader
          to stack-rank by.
          When coach_counts is absent (messages graded before
          migration 0040) the v5 enum is the fallback render. */}
      {isAgent && !isNote && (
        <div className="mt-2 pt-2 border-t border-[#FACC15]/20">
          {message.coachCounts ? (
            <CoachCountsRow
              counts={message.coachCounts}
              onAskCoPilot={onAskCoPilot}
              composerRef={composerRef}
            />
          ) : message.coachGrade ? (
            <CoachLegacyRow
              grade={message.coachGrade}
              reason={message.coachReasonInternal ?? null}
              onAskCoPilot={onAskCoPilot}
              composerRef={composerRef}
            />
          ) : (
            <span className="text-[10px] text-muted italic flex items-center gap-2">
              <Sparkles className="w-3 h-3" aria-hidden />
              Coach is reading…
            </span>
          )}
          {message.coPilotInvoked && (
            <p className="mt-1.5 text-[10px] text-muted italic">
              AI Co-Pilot helped draft this reply.
              {message.coPilotReasoning ? (
                <>
                  {" "}
                  Move: <span className="not-italic">{message.coPilotReasoning}</span>
                </>
              ) : null}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * §A11 count-display. The chip surfaces what's present in the
 * reply (positive counts FIRST per §A17 experiential contract)
 * and what's flagged (risk counts) — no verdict adjective. The
 * agent reads the pattern and decides whether it's fair. The
 * leader-of-6-months test passes because there's nothing to
 * stack-rank against.
 *
 * Display rules:
 *   - Positives shown as ✓ chips (green) — what the reply did.
 *   - Risk counts shown with the count and category (amber).
 *   - reason_internal printed as italic context.
 *   - When totalRisks > 0 OR < 2 positives, the §A7 next-step
 *     button surfaces ("Want a follow-up draft").
 */
function CoachCountsRow({
  counts,
  onAskCoPilot,
  composerRef,
}: {
  counts: CoachCounts;
  onAskCoPilot?: () => void;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const positiveTotal =
    counts.positive.acknowledged +
    counts.positive.answered +
    counts.positive.next_step;
  const riskTotal =
    counts.risks.unsupported_absolutes +
    counts.risks.fabricated_specifics +
    counts.risks.empty_filler;
  const showFollowUp = riskTotal > 0 || positiveTotal < 2;

  return (
    <div className="flex items-start gap-2">
      <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-brand" aria-hidden />
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted font-bold mr-1">
            Coach:
          </span>
          {counts.positive.acknowledged === 1 && (
            <PresenceChip label="acknowledged" />
          )}
          {counts.positive.answered === 1 && <PresenceChip label="answered" />}
          {counts.positive.next_step === 1 && (
            <PresenceChip label="next step" />
          )}
          {counts.positive.acknowledged === 0 && (
            <GapChip label="0 acknowledgment" />
          )}
          {counts.positive.answered === 0 && <GapChip label="0 answer" />}
          {counts.positive.next_step === 0 && (
            <GapChip label="0 next step" />
          )}
          {counts.risks.unsupported_absolutes > 0 && (
            <RiskChip
              label={`${counts.risks.unsupported_absolutes} unsupported absolute${counts.risks.unsupported_absolutes > 1 ? "s" : ""}`}
            />
          )}
          {counts.risks.fabricated_specifics > 0 && (
            <RiskChip
              label={`${counts.risks.fabricated_specifics} fabricated specific${counts.risks.fabricated_specifics > 1 ? "s" : ""}`}
            />
          )}
          {counts.risks.empty_filler > 0 && (
            <RiskChip
              label={`${counts.risks.empty_filler} empty filler${counts.risks.empty_filler > 1 ? "s" : ""}`}
            />
          )}
        </div>
        {counts.reason_internal && (
          <p className="text-[10px] text-secondary leading-relaxed italic">
            {counts.reason_internal}
          </p>
        )}
        {showFollowUp && onAskCoPilot && (
          <button
            type="button"
            onClick={() => {
              composerRef?.current?.focus();
              onAskCoPilot();
            }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:text-[#FACC15] border border-[#FACC15]/40 hover:border-[#FACC15]/70 bg-[#FACC15]/5 hover:bg-[#FACC15]/10 px-2 py-0.5 rounded transition-colors"
          >
            <Sparkles className="w-2.5 h-2.5" aria-hidden />
            Want a follow-up draft with this in mind?
          </button>
        )}
      </div>
    </div>
  );
}

function PresenceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
      <span aria-hidden>✓</span>
      {label}
    </span>
  );
}

function GapChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted bg-surface border border-default px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

function RiskChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

/**
 * v5 back-compat — render the legacy enum for messages graded
 * before migration 0040. Same shape as the prior implementation;
 * kept verbatim so existing data continues to display through
 * the transition. Deleted in a later commit once v5 data has
 * aged out per the §4 readout.
 */
function CoachLegacyRow({
  grade,
  reason,
  onAskCoPilot,
  composerRef,
}: {
  grade: "productive" | "neutral" | "needs_guidance" | "withheld";
  reason: string | null;
  onAskCoPilot?: () => void;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="flex items-start gap-2">
      <Sparkles
        className={`w-3 h-3 shrink-0 mt-0.5 ${
          grade === "productive"
            ? "text-emerald-300"
            : grade === "needs_guidance"
              ? "text-amber-300"
              : "text-secondary"
        }`}
        aria-hidden
      />
      <div className="flex-1">
        <span
          className={`text-[10px] uppercase tracking-widest font-bold ${
            grade === "productive"
              ? "text-emerald-300"
              : grade === "needs_guidance"
                ? "text-amber-300"
                : "text-muted"
          }`}
        >
          Coach: {grade === "needs_guidance" ? "needs guidance" : grade}
        </span>
        {reason && (
          <p className="text-[10px] text-secondary leading-relaxed mt-0.5 italic">
            {reason}
          </p>
        )}
        {grade === "needs_guidance" && onAskCoPilot && (
          <button
            type="button"
            onClick={() => {
              composerRef?.current?.focus();
              onAskCoPilot();
            }}
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:text-[#FACC15] border border-[#FACC15]/40 hover:border-[#FACC15]/70 bg-[#FACC15]/5 hover:bg-[#FACC15]/10 px-2 py-0.5 rounded transition-colors"
          >
            <Sparkles className="w-2.5 h-2.5" aria-hidden />
            Want a follow-up draft with this in mind?
          </button>
        )}
      </div>
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
  onFormulate,
  onAskCoach,
  isEmailChannel,
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
  onFormulate: () => void;
  onAskCoach: () => void;
  isEmailChannel?: boolean;
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
              onClick={onFormulate}
              title="Tell the System what you want to say; it shapes your intent into a clear reply"
              className="text-[11px] font-semibold text-secondary border border-default hover:border-strong hover:text-primary inline-flex items-center gap-1 px-2 py-0.5 rounded"
            >
              <Lightbulb className="w-3 h-3" aria-hidden />
              Help me formulate
            </button>
            <button
              type="button"
              onClick={onAskCoach}
              disabled={!draft.trim()}
              title="Get Coach feedback on your draft BEFORE you send it"
              className="text-[11px] font-semibold text-arc-300 border border-arc-400/40 hover:border-arc-400/70 bg-arc-400/5 hover:bg-arc-400/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 px-2 py-0.5 rounded"
            >
              <Wand2 className="w-3 h-3" aria-hidden />
              Ask Coach
            </button>
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
        Cmd/Ctrl+Enter to send ·{" "}
        {isInternalNote
          ? "Note stays internal."
          : isEmailChannel
            ? "Dispatches as outbound email to the customer."
            : "Customer sees this on the widget."}
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

// ─── Chat-tools port: Summarize / Formulate / Ask Coach ──────

/**
 * Slide-out modal showing the System's read of the thread.
 * Per §A11 the System's read is "confirm-or-correct" — the
 * agent renders the verdict.
 */
function SummarizeCarePanel({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/care/agent/conversations/${conversationId}/summarize`,
          { method: "POST" }
        );
        if (!res.ok) {
          setError("Couldn't generate a summary.");
          return;
        }
        const data = await res.json();
        setSummary(data.summary ?? "");
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [conversationId]);
  return (
    <ToolPanelShell title="Summary" onClose={onClose}>
      {loading && (
        <p className="text-xs text-muted flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Reading the thread…
        </p>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
      {summary && (
        <>
          <p className="text-xs uppercase tracking-widest text-muted font-bold mb-2">
            The System&apos;s read
          </p>
          <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
            {summary}
          </p>
          <p className="text-[10px] text-muted italic mt-3">
            §3.3 — this is the System&apos;s read, not a verdict.
            Confirm or correct it against the conversation itself.
          </p>
        </>
      )}
    </ToolPanelShell>
  );
}

/**
 * Slide-out modal that asks the agent for their intent, then
 * shapes it into a draft. Different from AI Co-Pilot — the
 * agent leads, the System edits.
 */
function FormulateCarePanel({
  conversationId,
  onClose,
  onApply,
}: {
  conversationId: string;
  onClose: () => void;
  onApply: (draft: string) => void;
}) {
  const [intent, setIntent] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [result, setResult] = useState<{
    draft: string;
    reasoning: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!intent.trim() || drafting) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${conversationId}/formulate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent }),
        }
      );
      if (!res.ok) {
        setError("Couldn't formulate a draft.");
        return;
      }
      const data = await res.json();
      setResult({ draft: data.draft, reasoning: data.reasoning });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <ToolPanelShell title="Help me formulate" onClose={onClose}>
      {!result ? (
        <>
          <p className="text-xs text-secondary leading-relaxed mb-3">
            Tell the System what you want to communicate. The System
            shapes your intent into a clear reply in the C.A.R.E
            voice — you stay in the driver&apos;s seat.
          </p>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={4}
            placeholder="e.g. tell them the refund will land in 5-7 business days, acknowledge the wait was longer than usual, offer to follow up if it doesn't arrive"
            className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y leading-relaxed"
          />
          {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!intent.trim() || drafting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-[#09090B] px-3 py-1.5 rounded-md"
            >
              {drafting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Lightbulb className="w-3.5 h-3.5" aria-hidden />
              )}
              Shape my draft
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs uppercase tracking-widest text-muted font-bold mb-2">
            Draft
          </p>
          <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap bg-surface/40 border border-default rounded-md p-3">
            {result.draft}
          </p>
          {result.reasoning && (
            <p className="text-[10px] text-muted italic mt-2">
              Move: {result.reasoning}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-xs text-secondary hover:text-primary border border-default hover:border-strong px-3 py-1.5 rounded-md"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => onApply(result.draft)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] px-3 py-1.5 rounded-md"
            >
              Use this draft
            </button>
          </div>
        </>
      )}
    </ToolPanelShell>
  );
}

/**
 * Slide-out modal showing pre-send Coach feedback on the
 * current draft. §A11 counts surfaced; agent renders verdict.
 * §A16 direction 2 composition — passes Co-Pilot reasoning
 * when available so deliberate shape choices don't get
 * penalized.
 */
function AskCoachCarePanel({
  conversationId,
  draft,
  coPilotReasoning,
  onClose,
}: {
  conversationId: string;
  draft: string;
  coPilotReasoning: string | null;
  onClose: () => void;
}) {
  type Counts = {
    positive: {
      acknowledged: 0 | 1;
      answered: 0 | 1;
      next_step: 0 | 1;
    };
    risks: {
      unsupported_absolutes: number;
      fabricated_specifics: number;
      empty_filler: number;
    };
    reason_internal: string;
  };
  const [counts, setCounts] = useState<Counts | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/care/agent/conversations/${conversationId}/ask-coach`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draft,
              coPilotReasoning: coPilotReasoning ?? null,
            }),
          }
        );
        if (!res.ok) {
          setError("Couldn't get Coach feedback.");
          return;
        }
        const data = await res.json();
        setCounts(data.counts ?? null);
        setReason(data.reasonInternal ?? null);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [conversationId, draft, coPilotReasoning]);

  return (
    <ToolPanelShell title="Ask Coach" onClose={onClose}>
      <p className="text-xs text-secondary leading-relaxed mb-3">
        Pre-send feedback on your draft. The Coach counts what&apos;s
        present and what&apos;s flagged — you decide whether the
        pattern is fair before you Send.
      </p>
      {loading && (
        <p className="text-xs text-muted flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Reading your draft…
        </p>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
      {counts && (
        <>
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {counts.positive.acknowledged === 1 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                ✓ acknowledged
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted bg-surface border border-default px-1.5 py-0.5 rounded">
                0 acknowledgment
              </span>
            )}
            {counts.positive.answered === 1 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                ✓ answered
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted bg-surface border border-default px-1.5 py-0.5 rounded">
                0 answer
              </span>
            )}
            {counts.positive.next_step === 1 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                ✓ next step
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted bg-surface border border-default px-1.5 py-0.5 rounded">
                0 next step
              </span>
            )}
            {counts.risks.unsupported_absolutes > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                {counts.risks.unsupported_absolutes} unsupported absolute
                {counts.risks.unsupported_absolutes > 1 ? "s" : ""}
              </span>
            )}
            {counts.risks.fabricated_specifics > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                {counts.risks.fabricated_specifics} fabricated specific
                {counts.risks.fabricated_specifics > 1 ? "s" : ""}
              </span>
            )}
            {counts.risks.empty_filler > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                {counts.risks.empty_filler} empty filler
                {counts.risks.empty_filler > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {(reason || counts.reason_internal) && (
            <p className="text-[11px] text-secondary leading-relaxed italic">
              {reason ?? counts.reason_internal}
            </p>
          )}
          <p className="text-[10px] text-muted italic mt-3">
            §A11 — counts, not verdict. Edit if the pattern reads
            unfair, then Send.
          </p>
        </>
      )}
    </ToolPanelShell>
  );
}

/**
 * Shared slide-out shell — right side panel, 400px wide on
 * desktop. The tool panels share the same chrome so the agent
 * gets a consistent surface.
 */
function ToolPanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-base border-l border-default h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-default flex items-center justify-between sticky top-0 bg-base">
          <h2 className="text-sm font-semibold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-primary p-1 rounded hover:bg-surface-raised"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
