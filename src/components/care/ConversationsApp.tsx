"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  GraduationCap,
  CheckCircle2,
  Clock,
  Filter,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wrench,
  HandHelping,
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
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import { careStatusDisplay } from "@/lib/care/statusLabels";
import type { ConversationDissect, CoachTurn } from "@/lib/dissect/types";
import { labelForAnyTopic } from "@/lib/care/handoverTopics";
import {
  playNewMessageChime,
  hasNewCustomerMessage,
  inboxHasNewCustomerMessage,
} from "@/lib/care/chime";
import { FileDropzone } from "@/components/files/FileDropzone";
import { InlineAttachment } from "@/components/files/InlineAttachment";
import { LearningHint } from "@/components/learning/LearningHint";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import { AdvancedDetail } from "@/components/experience/AdvancedDetail";
import { ExpertOnly } from "@/components/experience/ExpertOnly";
import Modal from "@/components/ui/Modal";
import { CoachDebriefCard } from "@/components/coach/CoachDebriefCard";
import type { CoachDebrief } from "@/lib/coach/v5/types";
import { priorityDisplay, tagTone } from "@/lib/care/tagColors";
import { useToast } from "@/components/ui/toast";
import { FloatingMenu } from "@/components/ui/FloatingMenu";
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
  supervisorGuidanceRequestedAt: string | null;
  slaFirstResponseMinutes: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  lastMessageAuthorType?: string | null; // 0087 — drives the inbox-wide chime

  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  /** Channel the conversation arrived through. Used to render
   *  a per-conversation channel badge + (for email) signal to
   *  the agent that their reply will dispatch as outbound email. */
  source?: "web_widget" | "embedded_widget" | "email" | string | null;
  /** Handover capture (0188) — the customer's concern captured on the handoff card.
   *  handoffTopic is a machine value (handoverTopics.ts); handoffTopicDetail is their
   *  own words on "Other"; orderNumber is the e-commerce reference. Null until captured. */
  handoffTopic?: string | null;
  handoffTopicDetail?: string | null;
  orderNumber?: string | null;
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
  /** 0058 — attachment kind for file uploads. */
  kind?: "message" | "attachment" | "system";
  mediaUrl?: string | null;
  mediaType?: string | null;
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
  | "needs_guidance"
  | "all_open"
  | "snoozed"
  | "resolved"
  | "closed"
  | "all";

const VIEWS: Array<{ key: ViewKey; label: string; icon: typeof Inbox }> = [
  { key: "mine", label: "Mine", icon: UserCheck },
  { key: "unassigned", label: "Unassigned", icon: Inbox },
  // 2026-06-17 — Needs guidance: conversations where an agent
  // has flagged a request for supervisor input. Distinct from
  // assignment routing — orthogonal axis per AMD-006 §1.5.1
  // layer 1 (structure: customer-flow status vs internal
  // escalation are separate fields).
  { key: "needs_guidance", label: "Needs guidance", icon: HandHelping },
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

/** Learning Mode hints for each inbox filter. Surfaces what the
 *  filter means + why it exists + how an agent should use it +
 *  the transferable principle. Per founder direction: hints
 *  teach, never just label. */
const VIEW_HINTS: Record<
  ViewKey,
  {
    whatItIs: string;
    why: string;
    how: string;
    principle?: string;
  }
> = {
  mine: {
    whatItIs:
      "Conversations currently assigned to you (the signed-in agent). The default landing view because the work you own is the work you can act on.",
    why: "Inbox views that default to 'all open' produce two failures: the agent loses time scanning for their own work, and the load-distribution signal (who owns what) disappears. 'Mine' is the single-agent operating view — what you owe a reply to right now.",
    how: "Open the conversation at the top, read the Read Phase, draft the reply. When you finish one, the next one bubbles up. If 'Mine' is empty, you're caught up — claim from Unassigned or check the team via 'All open'.",
    principle:
      "The agent's first question on landing is 'what do I owe a reply to?' — the inbox should answer it without scanning.",
  },
  unassigned: {
    whatItIs:
      "Conversations with no agent assigned yet. New customer messages, conversations the prior agent unclaimed, conversations that came in via channels that don't auto-assign.",
    why: "An unassigned conversation is a piece of work nobody owns. Without a clear surface for it, the team either over-routes (someone claims everything and burns out) or under-routes (conversations sit until the customer follows up). The view makes it explicit.",
    how: "Open a conversation, read it, and Claim if you're going to handle it. Or assign to the right agent if it's clearly someone else's. Don't park here — every minute an unassigned conversation sits is silently spending team reputation.",
    principle:
      "Unassigned is a queue, not a list. The right state for it is 'empty' at the end of every working hour.",
  },
  needs_guidance: {
    whatItIs:
      "Conversations where an agent has flagged supervisor guidance via the Request guidance button. Closed conversations are excluded — the flag only matters while the conversation is still in motion.",
    why: "Tribal escalation (DM the senior agent) is the failure mode every support team eventually pays for. A structural request routes the ask through the chain, makes it visible at the leadership layer, and produces a record. Per §A18 this surface is leadership-facing — agents see their own flags; admins see all of them.",
    how: "If you're an admin and this number is above zero, open the conversations and weigh in. The agent asked because the next move wasn't obvious to them — model the response so they recognize the shape next time. The teaching matters more than the answer.",
    principle:
      "Escalation is structural, not tribal. A team where 'who do I ask' is encoded in software produces fewer mistakes than a team where it lives in social capital.",
  },
  all_open: {
    whatItIs:
      "Every conversation in a non-resolved, non-closed state — across all agents, all channels, all assignment states. The full team's active work.",
    why: "Mine + Unassigned cover the operating view; All open covers the team-wide view. Useful for leaders monitoring load, for shift handoffs, and for spotting a conversation that's been forgotten across multiple agents.",
    how: "Skim periodically (once or twice a day) to see what the team is sitting on collectively. If you see a conversation that's been open for days with no progress, that's worth surfacing — not as a callout, as a question about whether the right agent has it.",
    principle:
      "All open is a leadership view, not an agent view. It exists to surface stuck work without singling out who's stuck.",
  },
  snoozed: {
    whatItIs:
      "Conversations the agent has explicitly parked — waiting for an internal answer, waiting for the customer to come back, waiting on a deploy. Snoozed conversations stay out of Mine and Unassigned until they unsnooze.",
    why: "Without a snooze affordance, agents either keep conversations in their active queue and lose the signal of 'what actually needs me now' or drop them entirely. Snooze makes the 'I'll come back to this' state structural rather than mental.",
    how: "Snooze when you're truly blocked on someone or something else and the timing is more than 30 minutes out. Don't snooze just to clear your queue — the customer is still waiting.",
    principle:
      "Snooze captures the 'parked' state honestly. Stale snoozes are worse than a full inbox because they hide work that's still owed.",
  },
  resolved: {
    whatItIs:
      "Conversations the agent marked resolved (with the reasoning captured). Customer can still reply — a reply reopens the conversation automatically. The 7-day durability check is scheduled the moment the resolution lands.",
    why: "A 'resolved' conversation isn't gone — it's resolved-but-watching. The customer might come back with a follow-up, and if they do, the System reopens the thread so the agent picks up where it stopped. The view exists for the agent who wants to re-read what they resolved (and for the audit trail of what worked).",
    how: "Browse resolved conversations periodically to see your own pattern of what worked. The team's Knowledge surface aggregates these across everyone, but your own resolved view is the most direct teaching for your own development.",
    principle:
      "Resolved is a state, not an end. A conversation reopens if the customer comes back — the System keeps watching even when the agent has moved on.",
  },
  closed: {
    whatItIs:
      "Conversations that were Closed (not Resolved) — archived without a captured resolution. Customer can still reopen via reply but the conversation no longer surfaces in the active views.",
    why: "Some conversations end without a 'resolution' in any meaningful sense (customer ghosted, spam, customer answered themselves). Forcing them through the resolution capture would corrupt the resolution corpus. Closed is the honest path.",
    how: "Browse Closed periodically only when you're auditing for shape (did the team Close conversations that should have been Resolved?). The number that should sit here is the legitimate 'nothing to capture' subset, not a shortcut around the discipline.",
    principle:
      "Closed without recording is appropriate when there's nothing to record. It should NEVER be a shortcut around the resolution capture for a real fix.",
  },
  all: {
    whatItIs:
      "Every conversation in the company across every state — open, resolved, closed, all assignment states, all channels. The complete record.",
    why: "Useful when searching for a specific customer's prior conversations, when reviewing a teammate's history, or when the other filters are too narrow. Less an operating view than an archival lookup view.",
    how: "Reach for All when you need to find something specific. Don't operate from it — it doesn't separate active work from history, so the signal-to-noise is too low to use as a default landing.",
    principle:
      "All is for search. The operating views are Mine, Unassigned, and Needs guidance — they're filtered for a reason.",
  },
};

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
  // Sound chime on a new CUSTOMER message (deferred backlog — opt-in per agent).
  // Persisted in localStorage; default OFF so it never surprises anyone. A ref
  // mirrors it so the 5s poll closure reads the current value without
  // re-subscribing the effect.
  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(false);
  // Inbox-wide chime (0087): track each conversation's last-seen lastMessageAt
  // so a NEW customer message in ANY conversation (not just the open one) chimes.
  // Primed on the first inbox load so the initial list never storms. selectedId
  // is mirrored so loadInbox (stable []-deps callback) can exclude the open
  // conversation — that one already chimes via the per-message path.
  const inboxSeenRef = useRef<Map<string, string | null>>(new Map());
  const inboxPrimedRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem("care.msgChime") === "on");
    } catch {
      /* private mode / no storage — stay off */
    }
  }, []);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);
  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("care.msgChime", next ? "on" : "off");
      } catch {
        /* best-effort persistence */
      }
      if (next) playNewMessageChime(); // preview + unlock the audio context on the toggle gesture
      return next;
    });
  }, []);
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
  // Standard/Expert experience mode — follows the existing ExperienceModeProvider
  // structure (founder 2026-07-25, CARE-Standard-Simplification spec). Standard = the
  // simplified 5-core-actions surface; Expert = today's full surface, unchanged (§6
  // "don't change advanced modes"). Nothing is deleted — advanced is collapsed
  // one-click-away (§1 "collapse, don't remove").
  const { isStandard, loaded: modeLoaded } = useExperienceMode();
  const [showAllViews, setShowAllViews] = useState(false);
  // Default view stays "all_open" at init so EXPERT is byte-for-byte unchanged (§6).
  // The Standard default (Mine) is applied by the loaded-gated effect below — computing
  // it from isStandard at init would wrongly flip Expert to Mine too, because isStandard
  // defaults true before the mode loads (audit Issue 1, §6 regression fix, 2026-07-25).
  const initialView =
    (searchParams.get("view") as ViewKey | null) ?? "all_open";
  const [view, setView] = useState<ViewKey>(initialView);
  const appliedStandardView = useRef(false);
  useEffect(() => {
    if (
      modeLoaded &&
      isStandard &&
      !searchParams.get("view") &&
      !appliedStandardView.current
    ) {
      appliedStandardView.current = true;
      setView("mine"); // Standard lands on Mine once the mode is confirmed (§3.1)
    }
  }, [modeLoaded, isStandard, searchParams]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
  // Per TT.md A21 audit (2026-06-18) MED finding — surface the
  // specific past resolutions the Co-Pilot leaned on, not just a
  // count. §3.6 make-learning-visible: the agent sees WHICH prior
  // case the System drew from, can verify it's a real precedent,
  // and judges whether the generalization is fair (§3.3).
  const [aiPrecedents, setAiPrecedents] = useState<
    Array<{
      id: string;
      issueSummary: string;
      category: string | null;
      whatWorked: string;
    }>
  >([]);
  // When the agent invokes the Co-Pilot we capture the original
  // draft so we can later record (draft, sent) into the learning
  // corpus on send.
  const [aiOriginalDraft, setAiOriginalDraft] = useState<string | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  // End-of-conversation Coach debrief (§3.6). On C.A.R.E the resolve
  // action auto-advances to the next conversation, so the debrief
  // can't render inline (the agent has moved on). It surfaces as a
  // dismissible overlay instead — auto-advance proceeds underneath,
  // the agent reads the debrief and dismisses it. Same engine + card
  // as Team Chat, composed to fit this surface's flow (§1.5.1 L3).
  const [debrief, setDebrief] = useState<CoachDebrief | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefModalOpen, setDebriefModalOpen] = useState(false);
  const [spawnTaskOpen, setSpawnTaskOpen] = useState(false);
  // Phase 8 (chat-tools port) — four agent helpers on the
  // conversation surface. State lives here so the modals can
  // render at the top level and the buttons can live in
  // DetailHeader / Composer via props.
  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [dissectOpen, setDissectOpen] = useState(false);
  const [formulateOpen, setFormulateOpen] = useState(false);
  const [askCoachOpen, setAskCoachOpen] = useState(false);
  // Transient hint when the top-toolbar Coach is clicked with an empty draft: Coach grades the
  // agent's reply DRAFT, so it needs one. Rather than silently grey the button (the confusion the
  // founder flagged on the composer-bar "Ask Coach"), we focus the composer and show this hint.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Resizable pane widths — list (between views nav and detail)
  // and customer panel (between detail and right edge). Defaults
  // mirror the original Tailwind w-80 (320px). Persisted per-user
  // in localStorage so the layout sticks across sessions, the
  // same way Zendesk / Intercom remember their column widths.
  const [listWidth, setListWidth] = useState<number>(320);
  const [customerWidth, setCustomerWidth] = useState<number>(320);
  // 2026-06-17 — collapsible state per AMD-006 §1.5.1 layer 3
  // (synergetic composition). Each non-middle panel can collapse
  // to a thin rail so the agent can reclaim screen space for the
  // conversation pane. The middle conversation pane is never
  // collapsible (per user spec — that's the active workspace).
  // Persisted alongside widths so the workspace shape survives
  // sessions.
  const [viewsCollapsed, setViewsCollapsed] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [customerCollapsed, setCustomerCollapsed] = useState(false);
  // Standard: default the customer panel collapsed (§3.2 — depth-on-demand; it's one
  // collapsible side panel, one click to open). Gated on modeLoaded so EXPERT never
  // regresses to collapsed; fires on mode resolution, not fighting a manual expand.
  useEffect(() => {
    if (modeLoaded && isStandard) setCustomerCollapsed(true);
  }, [modeLoaded, isStandard]);
  // Bulk selection — set of conversation ids the agent has
  // checkbox-marked for a bulk action. Cleared after each bulk
  // operation OR when the agent switches view (different filter
  // = different visible set, stale selections would be
  // confusing).
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkActing, setBulkActing] = useState(false);
  // Clear bulk selection when the view changes — different filter
  // shows different conversations, stale selections are confusing
  // and may not even be visible to act on.
  useEffect(() => {
    setBulkSelectedIds(new Set());
  }, [view]);
  useEffect(() => {
    try {
      // Check mobile FIRST — on mobile we ALWAYS force Views +
      // Customer collapsed at mount regardless of persisted state.
      // Without this override, a user who expanded Views on desktop
      // then opened the same login on mobile would see a Views pane
      // covering the entire phone screen with no way to know there's
      // a conversation list behind it.
      const isMobile =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 767px)").matches;

      const raw = window.localStorage.getItem("care-pane-widths");
      if (raw) {
        const v = JSON.parse(raw) as {
          list?: number;
          customer?: number;
          viewsCollapsed?: boolean;
          listCollapsed?: boolean;
          customerCollapsed?: boolean;
        };
        if (typeof v.list === "number") setListWidth(clampPane(v.list, 240, 520));
        if (typeof v.customer === "number")
          setCustomerWidth(clampPane(v.customer, 240, 520));
        if (isMobile) {
          // Force single-pane defaults on mobile, ignore persisted
          // expansion state (it was set on a different form factor).
          setViewsCollapsed(true);
          setCustomerCollapsed(true);
          setListCollapsed(false);
        } else {
          if (typeof v.viewsCollapsed === "boolean")
            setViewsCollapsed(v.viewsCollapsed);
          if (typeof v.listCollapsed === "boolean")
            setListCollapsed(v.listCollapsed);
          if (typeof v.customerCollapsed === "boolean")
            setCustomerCollapsed(v.customerCollapsed);
        }
      } else if (isMobile) {
        // First visit on mobile — same single-pane defaults.
        setViewsCollapsed(true);
        setCustomerCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  // Responsive collapse guard (founder 2026-07-24 — detail-panel collapse + Assign click-block).
  // Between mobile (<768, already forced single-pane) and a wide desktop, all fixed columns —
  // C.A.R.E nav (~168) + filter-views (~180) + list (~320) + customer panel (~320) ≈ 988px that
  // do NOT shrink — crush the flex-1 detail toward its min-w-0, so at a narrow/zoomed viewport
  // the conversation detail becomes an unusable sliver AND the crushed/overlapping customer panel
  // click-blocks the toolbar buttons (Assign/etc.) — the exact "buttons behind the panel" failure
  // DetailHeader documents. Auto-collapse the customer panel (its toggle rail stays, so nothing is
  // lost) whenever the viewport is too narrow for the detail to stay usable. Above the threshold we
  // do NOT force-expand — the user keeps whatever they chose when there's room. Threshold is a first
  // pass (needs runtime tuning against real window sizes); the customer panel is collapsed first
  // because it's the one that overlaps the toolbar.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    // LAYERED collapse (verified against an isolated headless render of the column mechanics):
    // collapsing ONLY the customer panel recovers the detail near ~1200px, but at the low desktop
    // end the always-on filter-views (~180) + list (~320) still crush it — so below ~1120px also
    // collapse the filter-views. Both keep a toggle rail (nothing lost). Above each threshold we do
    // NOT force-expand — the user keeps their choice when there's room. (Mobile <768 stays single-pane.)
    const mqCustomer = window.matchMedia("(min-width: 768px) and (max-width: 1439px)");
    const mqViews = window.matchMedia("(min-width: 768px) and (max-width: 1119px)");
    const apply = () => {
      if (mqCustomer.matches) setCustomerCollapsed(true);
      if (mqViews.matches) setViewsCollapsed(true);
    };
    apply();
    mqCustomer.addEventListener("change", apply);
    mqViews.addEventListener("change", apply);
    return () => {
      mqCustomer.removeEventListener("change", apply);
      mqViews.removeEventListener("change", apply);
    };
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "care-pane-widths",
        JSON.stringify({
          list: listWidth,
          customer: customerWidth,
          viewsCollapsed,
          listCollapsed,
          customerCollapsed,
        })
      );
    } catch {
      /* ignore */
    }
  }, [
    listWidth,
    customerWidth,
    viewsCollapsed,
    listCollapsed,
    customerCollapsed,
  ]);
  // Cross-tab sync. Bug fix: previously the pane state was only
  // written to localStorage on changes here. Another C.A.R.E tab
  // would write its own values to the same key but this tab never
  // observed those writes — so collapsing in one tab left the
  // other tab visually stale. The 'storage' event fires in OTHER
  // tabs when localStorage changes; we listen and re-hydrate the
  // collapse state (not the widths, since drag-resizing one tab
  // shouldn't yank the other tab's pane around mid-interaction —
  // user-facing toggles are the lower-noise sync target).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "care-pane-widths" || !e.newValue) return;
      try {
        const v = JSON.parse(e.newValue) as {
          viewsCollapsed?: boolean;
          listCollapsed?: boolean;
          customerCollapsed?: boolean;
        };
        if (typeof v.viewsCollapsed === "boolean")
          setViewsCollapsed(v.viewsCollapsed);
        if (typeof v.listCollapsed === "boolean")
          setListCollapsed(v.listCollapsed);
        if (typeof v.customerCollapsed === "boolean")
          setCustomerCollapsed(v.customerCollapsed);
      } catch {
        /* ignore malformed payload */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
      const convos: Conversation[] = data.conversations ?? [];
      // Inbox-wide chime (0087): after the first (priming) load, chime once if
      // ANY conversation OTHER than the open one just got a new customer
      // message. The open one is handled by the per-message path, so exclude it
      // to avoid a double chime. Needs 0087's last_message_author_type — before
      // it's applied lastMessageAuthorType is null and this simply never fires.
      if (
        inboxPrimedRef.current &&
        soundOnRef.current &&
        inboxHasNewCustomerMessage(
          inboxSeenRef.current,
          convos,
          selectedIdRef.current
        )
      ) {
        playNewMessageChime();
      }
      const nextSeen = new Map<string, string | null>();
      for (const c of convos) nextSeen.set(c.id, c.lastMessageAt);
      inboxSeenRef.current = nextSeen;
      inboxPrimedRef.current = true;
      setConversations(convos);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  // Team roster — drives the Assign dropdown. Refreshed in three
  // situations beyond the initial mount:
  //   - When the tab regains focus (user came back from another
  //     window where they may have added/removed teammates)
  //   - Every 5 minutes while the tab is foregrounded (catches
  //     adds made by another admin in another browser session)
  //   - Manually via loadTeam() after assign actions if we ever
  //     need it; not wired today (assign doesn't change team
  //     membership)
  // Previously fetched once on mount and never refreshed — bug
  // surface: a teammate added by another admin wouldn't appear
  // in the AssignDropdown until the agent reloaded the page.
  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/care/agent/team");
      if (!res.ok) return;
      const data = await res.json();
      setTeam(data.agents ?? []);
    } catch {
      /* non-fatal — assign dropdown just won't have options */
    }
  }, []);
  useEffect(() => {
    void loadTeam();
    const onFocus = () => {
      void loadTeam();
    };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(loadTeam, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [loadTeam]);

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
          // Re-check cancelled AFTER the await: a switch during the fetch must not
          // let this (now-stale) conversation's messages overwrite the new one.
          if (res.ok && !cancelled) {
            const data = await res.json();
            if (cancelled) return; // switch landed mid-parse — don't cross-render
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
              // Chime ONLY on a genuinely new CUSTOMER message (opt-in). This
              // runs in the poll, never on initial load, and never for the
              // agent's own sends (authorType filter). §3.4-honest: a real new
              // customer message, not any list churn.
              //
              // SCOPE (v1): fires for the OPEN conversation only — that's the
              // one place we have per-message authorType to distinguish a
              // customer reply from the AI first-responder's auto-reply. An
              // inbox-WIDE chime (any conversation) would need a reliable inbound
              // signal on the inbox row; today it only carries last_message_at,
              // which advances on AI/agent messages too, so a naive inbox-level
              // chime would false-fire. The clean extension is a
              // `last_message_author_type` column stamped by the same 0034
              // trigger that stamps last_message_at — deferred (notifications are
              // low-urgency per the backlog).
              if (soundOnRef.current && hasNewCustomerMessage(prev, next)) {
                playNewMessageChime();
              }
              return next;
            });
          }
          const evRes = await fetch(
            `/api/care/agent/conversations/${selectedId}/events`
          );
          if (evRes.ok && !cancelled) {
            const data = await evRes.json();
            if (cancelled) return; // switch landed mid-parse — don't cross-render
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
      case "needs_guidance":
        // Exclude closed conversations from the Needs guidance
        // view — a closed conversation with a lingering flag is
        // not actionable; the supervisor would just see noise.
        // (Bug fix: this filter previously included closed,
        // creating permanent zombie entries that compounded the
        // "no clearing path on closed" header bug.)
        list = list.filter(
          (c) =>
            c.supervisorGuidanceRequestedAt !== null &&
            c.status !== "closed"
        );
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
          (c.customer?.name ?? "").toLowerCase().includes(q) ||
          // Search the captured concern too (0188), so an agent can pull up all "billing" or
          // "order tracking" cases — the chip in the list is now actionable, not just visible.
          (labelForAnyTopic(c.handoffTopic) ?? "").toLowerCase().includes(q)
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
        needs_guidance: 0,
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
      needs_guidance: conversations.filter(
        (c) =>
          c.supervisorGuidanceRequestedAt !== null &&
          c.status !== "closed"
      ).length,
      all: conversations.length,
    } as Record<ViewKey, number>;
  }, [conversations, currentUserId]);

  // Selected conversation
  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  // Auto-select first in view if nothing is selected.
  //
  // Desktop only: this is a convenience so J/K keyboard nav has
  // a starting cursor and the right pane isn't a giant empty
  // state. On MOBILE the user only ever sees one pane at a time
  // and the auto-select would (1) skip the conversation list
  // entirely on load, dropping them straight into a Detail
  // they didn't pick, and (2) re-select immediately after the
  // user taps "Back to list", making the back button feel
  // broken.
  useEffect(() => {
    if (selectedId || !filtered[0]) return;
    const isMobile =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;
    setSelectedId(filtered[0].id);
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
  // Guard against a stale-response race: clicking conversation A then quickly B,
  // if A's fetch is slower, A's response must NOT overwrite B's messages (the
  // agent would see B's header with A's messages — and could reply to B with A's
  // context). Each call stamps the latest requested id; a response is applied
  // only if it's still the latest.
  const latestDetailReqRef = useRef<string | null>(null);
  const loadDetail = useCallback(async (id: string) => {
    latestDetailReqRef.current = id;
    setDetailLoading(true);
    try {
      const [convRes, evRes] = await Promise.all([
        fetch(`/api/care/agent/conversations/${id}`),
        fetch(`/api/care/agent/conversations/${id}/events`),
      ]);
      // A newer selection superseded this request — discard the stale response.
      // Re-check after EACH json() await, not just here: the parse is another
      // suspension point, so a switch landing mid-parse must not let this
      // conversation's messages render into the newly-selected one.
      if (latestDetailReqRef.current !== id) return;
      if (convRes.ok) {
        const data = await convRes.json();
        if (latestDetailReqRef.current !== id) return;
        setMessages(data.messages ?? []);
      }
      if (evRes.ok) {
        const data = await evRes.json();
        if (latestDetailReqRef.current !== id) return;
        setEvents(data.events ?? []);
      }
    } finally {
      // Only the latest request owns the loading flag.
      if (latestDetailReqRef.current === id) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reset the composer on EVERY conversation switch. `draft` (+ its AI provenance and note-mode)
    // is a single shared state, not per-conversation. Without this reset, an unsent reply typed for
    // conversation A stays in the composer when you open B — and Send would post A's words to B's
    // CUSTOMER, stamped with A's Co-Pilot provenance in the learning corpus (audit 2026-07-24, HIGH:
    // cross-conversation mis-send — "looks wired" because Send works, but sends stale content). The
    // apply-draft flows (Formulate/Coach) never change selectedId, so they are unaffected. Losing an
    // unsent draft on an explicit switch is the correct, safe trade vs. mis-sending it.
    setDraft("");
    setAiOriginalDraft(null);
    setAiReasoning(null);
    setAiPrecedents([]);
    setIsInternalNote(false);
    // Close every per-conversation OVERLAY/PANEL on switch — same bleed class as the draft (§A26).
    // These all bind to `selected` reactively: ResolutionCaptureModal + TaskRefinementPanel take
    // conversationId={selected.id}, so leaving one open and navigating (J/K works even under the
    // modal backdrop) would re-target it to the NEW conversation and capture the record against the
    // WRONG one. The read panels (Summarize/Dissect/Formulate/Ask-Coach) analyze the current
    // conversation, so they shouldn't linger showing another one either. DELIBERATELY EXCLUDES the
    // debrief (debrief/debriefModalOpen/debriefLoading): the resolve flow opens the debrief for the
    // just-resolved conversation and THEN auto-advances selectedId (onCaptured, 1851) — the debrief
    // is designed to survive that switch (§3.6), so resetting it here would close it instantly.
    setResolveModalOpen(false);
    setSpawnTaskOpen(false);
    setSummarizeOpen(false);
    setDissectOpen(false);
    setFormulateOpen(false);
    setAskCoachOpen(false);
    if (selectedId) {
      void loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  // Sync the route deep-link into the in-component selection. `selectedId` is seeded ONCE from
  // `initialId` (useState initializer, line ~347). But the deep-link route (/dashboard/care/
  // conversations/[id]) and the list route both render <ConversationsApp initialId=…/>, and App
  // Router PRESERVES this component across same-segment [id]→[id] navigation (it only swaps the prop,
  // no remount). So a push-notification / deep-link to conversation B while C.A.R.E is already open on
  // A would change initialId A→B but leave selectedId on A — the agent clicks the notification for B
  // and still sees A (audit 2026-07-24, reachable via notifications). Sync on initialId change only,
  // so this NEVER fights in-component switching (clicking a row sets selectedId, not initialId, so
  // this effect stays dormant). Guarded on a real id so it can't clear the selection.
  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

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
        // r/n focus the composer, which is HIDDEN on closed conversations (guard at ~1797). Match
        // that guard so the shortcut doesn't focus a null ref + set note-mode on a composer that
        // isn't rendered (audit 2026-07-24 — keyboard shortcuts must not bypass the visible affordance).
      } else if (e.key === "r" && selected && selected.status !== "closed") {
        e.preventDefault();
        setIsInternalNote(false);
        composerRef.current?.focus();
      } else if (e.key === "n" && selected && selected.status !== "closed") {
        e.preventDefault();
        setIsInternalNote(true);
        composerRef.current?.focus();
      } else if (
        e.key === "e" &&
        selected &&
        selected.status !== "resolved" &&
        selected.status !== "closed"
      ) {
        e.preventDefault();
        // E opens the capture modal — §1.1 discipline routes the resolve action through the learning
        // capture. Guarded to MATCH the toolbar Resolve button (hidden on resolved+closed, ~2499):
        // without this, `e` opened the Resolve modal on an already-resolved/closed conversation —
        // capturing a resolution the UI otherwise forbids (keyboard bypassed the button's guard).
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
    expect:
      | {
          status?: string;
          priority?: string;
          claimed?: boolean;
          // null = expect cleared (column is NULL); true = expect set
          // (column has a timestamp). Per the §1.6 divergence pattern
          // — a guidance toggle that says success but didn't flip
          // the column should surface, not silently lie.
          guidanceSet?: boolean;
        }
      | null,
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
          await Promise.all([loadInbox(), loadDetail(selected.id)]);
          return false;
        }
        if (expect.priority && fresh.priority !== expect.priority) {
          toast.error(
            `Priority change didn't stick — DB still reads "${fresh.priority}".`
          );
          await Promise.all([loadInbox(), loadDetail(selected.id)]);
          return false;
        }
        if (
          expect.claimed &&
          fresh.assignedAgentId !== currentUserId
        ) {
          toast.error("Claim didn't stick — conversation is still unassigned.");
          await Promise.all([loadInbox(), loadDetail(selected.id)]);
          return false;
        }
        if (expect.guidanceSet !== undefined) {
          const actualSet = fresh.supervisorGuidanceRequestedAt !== null;
          if (actualSet !== expect.guidanceSet) {
            toast.error(
              `Supervisor guidance ${expect.guidanceSet ? "request" : "clear"} didn't stick — DB still reads "${actualSet ? "requested" : "cleared"}".`
            );
            await Promise.all([loadInbox(), loadDetail(selected.id)]);
            return false;
          }
        }
      }
      toast.success(successMsg);
      // L3.3 fix: parallelize the inbox + detail refreshes.
      // Previously sequential — every action did two
      // round-trips serially when one is fine. Promise.all
      // halves the wall-clock on every action's "after" phase.
      await Promise.all([loadInbox(), loadDetail(selected.id)]);
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

  // Bulk actions — single endpoint POST with action discriminator.
  // After success: refresh inbox, clear selection. If the currently
  // selected detail conversation was part of the bulk and the
  // action moves it out of the current view, auto-advance (same
  // pattern as the single-action terminal auto-advance from
  // d9523a0).
  const runBulk = async (
    body: Record<string, unknown>,
    successMsgFn: (affected: number, requested: number) => string
  ): Promise<boolean> => {
    const ids = Array.from(bulkSelectedIds);
    if (ids.length === 0) return false;
    setBulkActing(true);
    // Snapshot the next conversation NOW if the currently-selected
    // detail is in the bulk — it'll drop out of the view after
    // the action and we want to advance into the gap.
    const selectedInBulk = selected && bulkSelectedIds.has(selected.id);
    const nextAfterBulk = selectedInBulk && selected
      ? computeNextAfterTerminal(selected.id)
      : null;
    try {
      const res = await fetch("/api/care/agent/conversations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(
          data?.error
            ? `Bulk action failed — ${data.error}`
            : "Bulk action failed. Please try again."
        );
        return false;
      }
      const affected = (data?.affectedCount as number) ?? 0;
      const requested = (data?.requestedCount as number) ?? ids.length;
      toast.success(successMsgFn(affected, requested));
      setBulkSelectedIds(new Set());
      await loadInbox();
      if (nextAfterBulk) setSelectedId(nextAfterBulk);
      return true;
    } catch {
      toast.error("Couldn't reach the server.");
      return false;
    } finally {
      setBulkActing(false);
    }
  };

  const bulkArchive = async () => {
    // Naming: the internal action is "archive" but the user-
    // facing verb matches the per-conversation header's "Close"
    // for vocabulary consistency (L4.2 fix). Both set
    // status='closed'; same operation, single word.
    await runBulk(
      { action: "status", status: "closed" },
      (n) => `Closed ${n} conversation${n === 1 ? "" : "s"}.`
    );
  };
  const bulkReopen = async () => {
    await runBulk(
      { action: "status", status: "open" },
      (n) => `Reopened ${n} conversation${n === 1 ? "" : "s"}.`
    );
  };
  const bulkAssignTo = async (targetAgentId: string | null) => {
    await runBulk(
      { action: "assign", targetAgentId },
      (affected, requested) => {
        if (affected < requested) {
          return targetAgentId
            ? `Assigned ${affected} of ${requested} (${requested - affected} couldn't be reassigned).`
            : `Unassigned ${affected} of ${requested}.`;
        }
        return targetAgentId
          ? `Assigned ${affected} conversation${affected === 1 ? "" : "s"}.`
          : `Unassigned ${affected} conversation${affected === 1 ? "" : "s"}.`;
      }
    );
  };

  const assignTo = async (targetAgentId: string | null) => {
    await runAction(
      { action: "assign", targetAgentId },
      null,
      targetAgentId ? "Assigned." : "Unassigned."
    );
  };

  const toggleSupervisorGuidance = async () => {
    if (!selected) return;
    const isRequested = selected.supervisorGuidanceRequestedAt !== null;
    await runAction(
      {
        action: isRequested
          ? "clear_supervisor_guidance"
          : "request_supervisor_guidance",
      },
      // Bug fix: previously passed null, bypassing divergence
      // detection. Now expresses the expected post-action state
      // so runAction can verify the column actually changed.
      { guidanceSet: !isRequested },
      isRequested
        ? "Cleared supervisor guidance request."
        : "Flagged for supervisor guidance."
    );
  };

  // Compute the "next" selection BEFORE the current conversation
  // leaves the view. After a terminal action (close/resolve) the
  // current conversation drops out of the filtered list, so we
  // snapshot the neighbor here, then apply it after the action
  // succeeds. §A8 composition: terminal actions compose with
  // workflow advancement instead of dropping the agent into an
  // empty state.
  const computeNextAfterTerminal = (currentId: string): string | null => {
    const idx = filtered.findIndex((c) => c.id === currentId);
    if (idx === -1) return filtered[0]?.id ?? null;
    return filtered[idx + 1]?.id ?? filtered[idx - 1]?.id ?? null;
  };

  // Generate the end-of-conversation debrief for a just-resolved
  // conversation and surface it as a dismissible overlay. Called from
  // the resolve onCaptured AFTER the resolution lands, with the
  // resolved conversation's id captured before auto-advance changes
  // the selection. Non-blocking — failures simply don't open the modal.
  const generateCareDebrief = async (conversationId: string) => {
    setDebrief(null);
    setDebriefLoading(true);
    setDebriefModalOpen(true);
    try {
      const res = await fetch("/api/coach/v5/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: "support_conversation",
          conversationId,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.debrief?.hasSignal) {
          setDebrief(j.debrief);
        } else {
          // Nothing to teach this conversation — don't interrupt the
          // agent with an empty overlay; just close it.
          setDebriefModalOpen(false);
        }
      } else {
        setDebriefModalOpen(false);
      }
    } catch {
      setDebriefModalOpen(false);
    } finally {
      setDebriefLoading(false);
    }
  };

  const changeStatus = async (
    next: "in_conversation" | "awaiting_customer" | "resolved" | "closed"
  ) => {
    const isTerminal = next === "closed" || next === "resolved";
    const nextAfter =
      isTerminal && selected ? computeNextAfterTerminal(selected.id) : null;
    const ok = await runAction(
      { action: "status", status: next },
      { status: next },
      `Marked as ${careStatusDisplay(next).label}`
    );
    // Auto-advance — the inbox flow the user explicitly asked for
    // ("after closing it should immediately open the next
    // message"). Only after success; only for terminal states;
    // only when the next slot exists. Falls back to the current
    // conversation staying selected (it'll just be filtered out
    // of the active view, which is fine — agent can re-click).
    if (ok && isTerminal && nextAfter) {
      setSelectedId(nextAfter);
    }
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
    setAiPrecedents([]);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${selected.id}/co-pilot`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.suppressed) {
          toast.info(
            data.message ??
              "Co-Pilot is in control window — draft solo for now."
          );
          composerRef.current?.focus();
          return;
        }
        const draftText = data.draft ?? "";
        setDraft(draftText);
        setAiOriginalDraft(draftText);
        setIsInternalNote(false);
        if (data.reasoning) setAiReasoning(data.reasoning);
        if (Array.isArray(data.precedents)) {
          setAiPrecedents(data.precedents);
        }
        composerRef.current?.focus();
      } else {
        // Surface the real provider cause the route now returns (2026-07-25).
        const errData = await res.json().catch(() => null);
        toast.error(
          errData?.detail
            ? `Co-pilot couldn't draft — ${errData.detail}`
            : "Co-pilot couldn't draft."
        );
      }
    } finally {
      setAiDrafting(false);
    }
  };

  // NOTE (2026-07-25): the Standard auto-pre-draft (auto-run Co-Pilot on ticket open)
  // was REVERTED. It auto-fired an LLM call on every qualifying open, which — while the
  // provider is erroring ("Co-pilot couldn't draft") — meant firing failing calls on
  // every open, and it was an unverified behavior change the founder flagged. Co-Pilot is
  // manual again (the composer's AI Co-pilot button). Re-add deliberately once the
  // provider is confirmed healthy and the founder opts in.

  // ─── Render ─────────────────────────────────────────────────

  // Mobile single-pane logic: on < md viewports only ONE pane is
  // visible at a time. The order of precedence top-down:
  //   1. Views (when expanded) — drawer/full-width overlay
  //   2. Customer (when expanded) — drawer/full-width overlay
  //   3. Detail (when a conversation is selected)
  //   4. List (default)
  // Desktop (md+) renders all panes side-by-side as before.
  const mobileShowViews = !viewsCollapsed;
  const mobileShowCustomer = !customerCollapsed && selectedId !== null;
  const mobileShowDetail =
    selectedId !== null && !mobileShowViews && !mobileShowCustomer;
  const mobileShowList = !mobileShowViews && !mobileShowCustomer && !mobileShowDetail;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* LEFT — Views + search + tag filters */}
      {viewsCollapsed ? (
        <CollapsedRail
          ariaLabel="Expand Conversations views"
          onExpand={() => setViewsCollapsed(false)}
        />
      ) : (
        <aside
          className={`w-full md:w-60 flex-shrink-0 border-r border-default bg-white/[0.01] flex-col ${
            mobileShowViews ? "flex" : "hidden md:flex"
          }`}
        >
        <div className="px-4 py-3 border-b border-default flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-primary">Conversations</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={
                soundOn
                  ? "Message sound on — click to mute"
                  : "Message sound off — click to enable"
              }
              aria-pressed={soundOn}
              title={
                soundOn
                  ? "Chime on new customer messages: ON"
                  : "Chime on new customer messages: OFF"
              }
              className={`p-1 rounded hover:bg-white/[0.04] ${
                soundOn ? "text-brand" : "text-muted hover:text-primary"
              }`}
            >
              {soundOn ? (
                <Volume2 className="w-3.5 h-3.5" aria-hidden />
              ) : (
                <VolumeX className="w-3.5 h-3.5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewsCollapsed(true)}
              aria-label="Collapse Conversations views"
              title="Collapse"
              className="text-muted hover:text-primary p-1 rounded hover:bg-white/[0.04]"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="px-3 py-3 space-y-0.5">
          {/* Standard: default to Mine only; the other 7 views collapse behind a
              single "More views" reveal (§3.1 — default to My Tickets, other queues
              one click away). Expert: all views inline as today. Collapse, not remove. */}
          {(isStandard && !showAllViews
            ? VIEWS.filter((v) => v.key === "mine")
            : VIEWS
          ).map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            const count = viewCounts[v.key];
            const hint = VIEW_HINTS[v.key];
            return (
              <LearningHint
                key={v.key}
                as="block"
                category="C.A.R.E · Inbox filter"
                title={v.label}
                whatItIs={hint.whatItIs}
                why={hint.why}
                how={hint.how}
                principle={hint.principle}
              >
                <button
                  type="button"
                  onClick={() => {
                    setView(v.key);
                    // Mobile UX: picking a filter should auto-
                    // collapse the Views drawer AND clear any
                    // previously-selected conversation, so the
                    // user lands on the filtered List — not on
                    // a stale Detail from the previous filter.
                    if (
                      typeof window !== "undefined" &&
                      window.matchMedia &&
                      !window.matchMedia("(min-width: 768px)").matches
                    ) {
                      setViewsCollapsed(true);
                      setSelectedId(null);
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-ember-400/10 text-brand"
                      : "text-secondary hover:text-primary hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden />
                  <span className="flex-1 text-left">{v.label}</span>
                  <span className="text-[10px] font-mono text-muted">
                    {count}
                  </span>
                </button>
              </LearningHint>
            );
          })}
          {/* One-click reveal for the other queues (Standard only). */}
          {isStandard && (
            <button
              type="button"
              onClick={() => setShowAllViews((s) => !s)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-brand hover:bg-white/[0.03]"
              aria-expanded={showAllViews}
            >
              {showAllViews ? (
                <ChevronDown className="w-3 h-3" aria-hidden />
              ) : (
                <ChevronRight className="w-3 h-3" aria-hidden />
              )}
              {showAllViews ? "Fewer views" : "More views"}
            </button>
          )}
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
      )}

      {/* CENTER — List + detail */}
      <div className="flex flex-1 min-w-0 min-h-0">
        {/* List pane */}
        {listCollapsed ? (
          <CollapsedRail
            ariaLabel="Expand conversation list"
            onExpand={() => setListCollapsed(false)}
          />
        ) : (
        <div
          // Mobile: full width when this is the active pane;
          // hidden otherwise. md+: persisted user width via CSS
          // variable so the resize handle still works on desktop.
          style={{ "--care-list-w": `${listWidth}px` } as React.CSSProperties}
          className={`flex-shrink-0 border-r border-default flex-col w-full md:w-[var(--care-list-w)] ${
            mobileShowList ? "flex" : "hidden md:flex"
          }`}
        >
          {/* Mobile-only active-view label. Without it the list
              header had only Filter icon + search box and the user
              couldn't tell WHICH filter they were viewing — the
              Views drawer was their only signal and that was now
              dismissed. Desktop has the persistent Views pane
              showing the active filter, so this label is md:hidden. */}
          {(() => {
            const active = VIEWS.find((v) => v.key === view);
            if (!active) return null;
            const Icon = active.icon;
            return (
              <div className="md:hidden flex items-center gap-2 px-3 pt-2 pb-1">
                <Icon className="w-3.5 h-3.5 text-brand" aria-hidden />
                <span className="text-[10px] uppercase tracking-widest text-brand font-bold">
                  {active.label}
                </span>
              </div>
            );
          })()}
          {/* Search + collapse */}
          <div className="px-3 py-2 border-b border-default flex items-center gap-2">
            {/* Mobile-only Filter / Views button — re-opens the
                Views drawer. Without this, mobile users who picked
                a view earlier (which auto-collapsed Views) would
                have no way to change view. */}
            <button
              type="button"
              onClick={() => setViewsCollapsed(false)}
              aria-label="Show views / filters"
              title="Filters"
              className="md:hidden text-muted hover:text-primary p-1.5 rounded hover:bg-white/[0.04] shrink-0"
            >
              <Filter className="w-4 h-4" aria-hidden />
            </button>
            <div className="relative flex-1 min-w-0">
              <Search
                className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
            <button
              type="button"
              onClick={() => setListCollapsed(true)}
              aria-label="Collapse conversation list"
              title="Collapse"
              className="hidden md:inline-flex text-muted hover:text-primary p-1 rounded hover:bg-white/[0.04] shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>

          {/* Bulk action bar — sticky above the list when N≥1
              conversations are selected. Per AMD-006 layer 4:
              uses the same vocabulary as the per-row actions
              (Assign / Archive / Reopen / Clear) so the agent
              doesn't have to learn two patterns. */}
          {bulkSelectedIds.size > 0 && (
            <BulkActionBar
              count={bulkSelectedIds.size}
              team={team}
              currentUserId={currentUserId}
              viewKey={view}
              acting={bulkActing}
              onClear={() => setBulkSelectedIds(new Set())}
              onArchive={bulkArchive}
              onReopen={bulkReopen}
              onAssign={bulkAssignTo}
            />
          )}
          {error ? (
            <div className="p-4 text-xs text-red-700 dark:text-red-300">{error}</div>
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
                  bulkSelected={bulkSelectedIds.has(c.id)}
                  onClick={() => setSelectedId(c.id)}
                  onBulkToggle={() => {
                    setBulkSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    });
                  }}
                />
              ))}
            </ul>
          )}
        </div>
        )}

        {!listCollapsed && (
          <PaneSplitter
            onDrag={(dx) =>
              setListWidth((w) => clampPane(w + dx, 240, 520))
            }
            ariaLabel="Resize conversation list"
          />
        )}

        {/* Detail pane.
            Mobile: visible only when a conversation is selected
            AND no other drawer (Views/Customer) is open.
            Desktop: always rendered as the center flex-1 region. */}
        <div
          // min-w-0 lets flex shrink the detail on mobile (single-pane); md:min-w-[380px] GUARANTEES the
          // conversation detail never crushes below a usable width on desktop no matter what the other
          // panes do (founder 2026-07-24: detail collapsed to a char-by-char sliver at narrow widths —
          // the responsive auto-collapse frees space, this is the hard floor so it can never crush again;
          // if the row can't fit, the far-right customer pane clips under overflow-hidden, keeping the
          // WORK area usable, which is the correct priority).
          className={`flex-1 min-w-0 md:min-w-[380px] flex-col ${
            mobileShowDetail ? "flex w-full" : "hidden md:flex"
          }`}
        >
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
              {/* Mobile back-to-list button — md+ never see this
                  because the List pane is still visible to the
                  left. On mobile the List is hidden when Detail
                  is showing, so the user needs an explicit way
                  back to the conversation list. */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="md:hidden flex items-center gap-1.5 text-xs text-secondary hover:text-primary border-b border-default px-4 py-2 transition-colors"
                aria-label="Back to conversation list"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Back to list
              </button>
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
                onToggleGuidance={toggleSupervisorGuidance}
                onSummarize={() => setSummarizeOpen(true)}
                onDissect={() => setDissectOpen(true)}
                onCoach={() => {
                  // ALWAYS open the Coach panel so a click ALWAYS produces a visible result. Founder
                  // 2026-07-24: clicking Coach with an empty composer did nothing but a subtle 4s toast
                  // → read as "the Coach isn't working." Now it opens the same AskCoachCarePanel every
                  // time; the panel grades the reply DRAFT, and if the composer is empty it shows a
                  // "type your reply first" prompt (then grades automatically once the agent types — the
                  // composer stays visible beside the right-side drawer). Focus the composer on an empty
                  // draft so they can start typing immediately.
                  if (!draft.trim()) composerRef.current?.focus();
                  setAskCoachOpen(true);
                }}
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
                className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-3 bg-white/[0.01]"
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
                  aiPrecedents={aiPrecedents}
                  composerRef={composerRef}
                  conversationId={selected.id}
                  onSpawnTask={() => setSpawnTaskOpen(true)}
                  onFormulate={() => setFormulateOpen(true)}
                  onAskCoach={() => setAskCoachOpen(true)}
                  onSummarize={() => setSummarizeOpen(true)}
                  onAssetUploaded={() => void loadDetail(selected.id)}
                  isEmailChannel={selected.source === "email"}
                />
              )}
            </>
          )}
        </div>

        {/* RIGHT — Customer panel + timeline.
            Mobile: only visible when explicitly open AND a
            conversation is selected; otherwise hidden so the
            single-pane mobile UX is preserved.
            Desktop: rail when collapsed, full pane when open. */}
        {selected && (
          customerCollapsed ? (
            <div className="hidden md:flex">
              <CollapsedRail
                ariaLabel="Expand customer panel"
                onExpand={() => setCustomerCollapsed(false)}
                chevronDir="left"
              />
            </div>
          ) : (
            <div
              className={`${mobileShowCustomer ? "flex w-full" : "hidden md:flex"} flex-shrink-0`}
            >
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
                onCollapse={() => setCustomerCollapsed(true)}
              />
            </div>
          )
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
            // Capture the resolved conversation id BEFORE auto-advance
            // changes the selection, then fire the debrief overlay
            // (§3.6). Non-blocking — runs alongside the auto-advance.
            void generateCareDebrief(selected.id);
            // Same auto-advance pattern as changeStatus for
            // terminal actions — the agent finished this
            // conversation, give them the next one without an
            // empty-state interrupt. Snapshotting the neighbor
            // BEFORE the inbox reload because the resolved
            // conversation will drop out of the active view
            // (Unassigned / All open / Mine all exclude
            // resolved).
            const nextAfter = computeNextAfterTerminal(selected.id);
            void loadInbox();
            if (nextAfter) {
              setSelectedId(nextAfter);
            } else {
              // Bug fix: previously fell back to
              // loadDetail(selected.id) which reloaded the
              // just-resolved conversation that's no longer in
              // the current filter view (Mine / Unassigned /
              // All open exclude resolved). The detail pane
              // showed a conversation the user couldn't find
              // in the list, creating a confusing
              // ghost-selection state. Clearing the selection
              // is the honest move — the existing
              // "Select a conversation" empty state then
              // surfaces correctly.
              setSelectedId(null);
            }
          }}
        />
      )}

      {/* End-of-conversation Coach debrief overlay (§3.6). Appears
          after resolve; auto-advance has already moved the agent to
          the next conversation underneath, so this is a dismissible
          teaching moment, not an inline panel. Only opens when there's
          real signal (generateCareDebrief closes it otherwise). */}
      {debriefModalOpen && (
        <Modal
          open
          onClose={() => setDebriefModalOpen(false)}
          title="Conversation debrief"
          size="md"
        >
          <div className="space-y-4">
            <CoachDebriefCard debrief={debrief} loading={debriefLoading} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDebriefModalOpen(false)}
                className="text-xs bg-gold-400 hover:bg-gold-500 text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </Modal>
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
      {selected && dissectOpen && (
        <DissectCarePanel
          conversationId={selected.id}
          onClose={() => setDissectOpen(false)}
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
          onAcceptRevision={(revised) => {
            setDraft(revised);
            setAskCoachOpen(false);
            composerRef.current?.focus();
          }}
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
  bulkSelected,
  onClick,
  onBulkToggle,
}: {
  conversation: Conversation;
  selected: boolean;
  bulkSelected: boolean;
  onClick: () => void;
  onBulkToggle: () => void;
}) {
  // Standard: keep rows to the essentials (customer/subject/priority/time/status) —
  // tag chips are metadata, still shown on the ticket when opened (§3.2, collapse
  // not remove). Expert: rows unchanged.
  const { isStandard } = useExperienceMode();
  const dl = careStatusDisplay(c.status);
  const pri = priorityDisplay(c.priority);
  const Icon = dl.icon;
  const slaPct = computeSlaPct(c);
  return (
    <li className="flex items-stretch">
      {/* Bulk select checkbox — sits OUTSIDE the row button so
          clicking the checkbox doesn't also trigger row-select.
          Per AMD-006 layer 3 (composition): the two actions
          (open conversation vs add to selection) must not
          collide. */}
      {/* Bulk-select is an Expert-tier multi-ticket action (§3.1); Standard is one
          ticket at a time, so the checkbox is hidden there. Expert unchanged (§6). */}
      {!isStandard && (
        <label
          className={`pl-3 pr-1 py-2.5 flex items-start cursor-pointer ${
            bulkSelected ? "bg-ember-400/[0.04]" : ""
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={bulkSelected}
            onChange={onBulkToggle}
            aria-label="Select conversation for bulk action"
            className="mt-0.5 w-3.5 h-3.5 accent-ember-400 cursor-pointer"
          />
        </label>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`flex-1 text-left pl-1 pr-3 py-2.5 transition-colors flex items-start gap-2.5 ${
          selected
            ? "bg-ember-400/[0.06] border-l-2 border-ember-400"
            : bulkSelected
              ? "bg-ember-400/[0.04] border-l-2 border-transparent"
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
          {/* Captured concern (0188) surfaced in the LIST, not just the header — so an agent
              triaging the inbox sees what each conversation is about at a glance, without
              opening it (§1.5.1 workflow: faster triage). Only shown once captured. */}
          {c.handoffTopic && (
            <span
              title="What the customer said this is about"
              className="mt-1 inline-flex max-w-full items-center gap-1 rounded border border-default bg-surface/50 px-1.5 py-0.5 text-[9px] text-secondary"
            >
              <span className="truncate">{labelForAnyTopic(c.handoffTopic)}</span>
            </span>
          )}
          {c.supervisorGuidanceRequestedAt && (
            <span
              title="Supervisor guidance has been requested on this conversation"
              className="mt-1 inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300"
            >
              <HandHelping className="w-2.5 h-2.5" aria-hidden />
              Needs guidance
            </span>
          )}
          {!isStandard && c.tags.length > 0 && (
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

/**
 * Handover capture line (0188) — a compact strip in the conversation header showing what
 * the customer told the widget when Jeff handed off: their concern (topic + free text),
 * order number, name, and email. Renders nothing if nothing was captured, so a normal
 * conversation header is unchanged. The email is surfaced here (not only in the Customer
 * panel) because it's the agent's reply address — the founder's screenshot pointed here.
 */
function HandoffCaptureLine({ conversation }: { conversation: Conversation }) {
  const concernLabel = labelForAnyTopic(conversation.handoffTopic);
  const detail = conversation.handoffTopicDetail?.trim() || null;
  const orderNumber = conversation.orderNumber?.trim() || null;
  const email = conversation.customer?.email?.trim() || null;
  const name = conversation.customer?.name?.trim() || null;

  // Nothing captured → render nothing (header stays as it was pre-0188).
  if (!concernLabel && !detail && !orderNumber && !email && !name) return null;

  const chip =
    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-default bg-surface/50 text-secondary max-w-full";

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {concernLabel && (
        <span className={chip} title={detail ? `“${detail}”` : undefined}>
          <span className="text-muted">Concern:</span>
          <span className="text-primary font-medium truncate">
            {concernLabel}
            {detail ? ` — ${detail}` : ""}
          </span>
        </span>
      )}
      {orderNumber && (
        <span className={chip}>
          <span className="text-muted">Order #</span>
          <span className="text-primary font-medium truncate">{orderNumber}</span>
        </span>
      )}
      {name && (
        <span className={chip}>
          <span className="text-primary font-medium truncate">{name}</span>
        </span>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className={`${chip} hover:border-strong`}
          title={`Email ${email}`}
        >
          <Mail className="w-3 h-3 text-muted" aria-hidden />
          <span className="text-primary truncate">{email}</span>
        </a>
      )}
    </div>
  );
}

function DetailHeader({
  conversation,
  acting,
  team,
  currentUserId,
  isAdmin: _isAdmin,
  onClaim,
  onAssign,
  onToggleGuidance,
  onResolve,
  onClose,
  onPriorityChange,
  onSummarize,
  onDissect,
  onCoach,
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
  onToggleGuidance: () => void;
  onResolve: () => void;
  onClose: () => void;
  onPriorityChange: (priority: string) => void;
  onSummarize: () => void;
  onDissect: () => void;
  onCoach: () => void;
}) {
  // Standard: fold the AI-read tools (Summarize/Dissect) behind one "Tools" reveal to
  // declutter the toolbar (§3.2, collapse-don't-remove). Expert: inline as today (§6).
  const { isStandard } = useExperienceMode();
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const dl = careStatusDisplay(conversation.status);
  const Icon = dl.icon;
  return (
    <div className="border-b border-default px-4 md:px-6 py-3 bg-base/40 overflow-hidden">
      {/* Mobile: stack title/badges and action row vertically so
          the chips don't compete with the buttons for horizontal
          space and overlap. Desktop (md+): side-by-side as before.
          min-w-0 on the container so flex items can shrink below
          their intrinsic content width (per 2026-06-22 layout bug
          report: chips were overflowing into the Customer pane). */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-primary truncate">
            {conversation.subject ?? "Untitled conversation"}
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${dl.tone.border} ${dl.tone.bg} ${dl.tone.text}`}
            >
              <Icon className="w-3 h-3" aria-hidden />
              {dl.label}
            </span>
            {/* Channel badge — Phase 4. Email surfaces with a
                distinct chip so the agent knows their reply will
                dispatch as outbound email. */}
            {conversation.source === "email" && (
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-arc-400/40 bg-arc-400/10 text-brand"
                title="This conversation arrived via email. Replies will be dispatched as outbound email."
              >
                <Mail className="w-3 h-3" aria-hidden />
                Email
              </span>
            )}
            {conversation.aiResponding && (
              <span className="inline-flex items-center gap-1 text-[10px] text-brand">
                <Sparkles className="w-3 h-3" aria-hidden />
                AI responding
              </span>
            )}
            {/* Priority + tags are metadata — Expert-only in Standard (§3.2). */}
            {!isStandard && (
              <PriorityDropdown
                current={conversation.priority}
                onChange={onPriorityChange}
              />
            )}
            {!isStandard &&
              conversation.tags.map((t) => {
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
          {/* Handover capture (0188) — the details the customer gave when Jeff handed
              off (requirement #2: visible to the agent). Only rendered when something
              was captured; the customer email is here too so the agent has the reply
              address at a glance without expanding the Customer panel. */}
          <HandoffCaptureLine conversation={conversation} />
        </div>
        {/* relative z-10 (restored 2026-07-24): the toolbar is right-aligned (md:justify-end), so its
            rightmost buttons — Assign / Resolve / Close — sit closest to the customer panel on the far
            right. When the layout is tight the panel overlaps them and, without a stacking context here,
            they render visually present but CLICK-BLOCKED by the panel underneath (the documented
            "Close button not working" failure — same class as the founder-reported "Assign does
            nothing"). `relative z-10` lifts the whole button row above any overlapping sibling so every
            button stays reachable. */}
        <div className="relative z-10 flex items-center gap-1.5 flex-wrap justify-start md:justify-end gap-y-2 min-w-0 md:max-w-[60%] pt-1 md:pt-0 border-t md:border-t-0 border-default md:border-transparent">
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
          {/* Agent Tools (founder 2026-07-25): the conversation-analysis tools grouped
              behind ONE control. Summarize moved to the composer with the reply-flow tools;
              Dissect (+ Coach, Decision Dialogue below) are the analysis tools. All modes. */}
          {!toolsExpanded ? (
            <button
              type="button"
              onClick={() => setToolsExpanded(true)}
              title="Agent Tools — Dissect, Coach, Decision Dialogue"
              className="inline-flex items-center gap-1 text-xs text-brand border border-arc-400/40 hover:border-arc-400/70 px-3 py-1.5 rounded-md"
            >
              <Wrench className="w-3.5 h-3.5" aria-hidden /> Agent Tools
            </button>
          ) : (
            <>
          {/* Dissect a Conversation (founder 2026-07-21) — the standalone diagnostic engine,
              brought into the inbox. Where Summarize is a catch-up READ, Dissect is the
              problem-solving LENS: problem, evidence, root cause, outside view, angles to
              consider — ending on a guiding question so the agent renders the verdict (§A11). */}
          <LearningHint
            category="AI · C.A.R.E"
            title="Dissect"
            whatItIs="The System's problem-solving read of this conversation — the core problem, evidence quoted from the thread, the root cause (not just the symptom), how a detached observer would see it, and a few angles to consider. It ends on a question, not an answer."
            why="Summarize catches you up; Dissect helps you SOLVE. On a stuck or tangled case, it separates the symptom the customer names from the root cause underneath, and grounds every claim in a quoted moment — so you act on the real problem, not the loudest one."
            how="Open it on a hard case. Read the problem and its evidence, check the root cause against your own read, then use the angles as starting points — not instructions. You decide the reply."
            principle="A diagnosis is the System's read, not a prescription — it surfaces the problem and the evidence; you render the verdict (§3.3)."
          >
            <button
              type="button"
              onClick={onDissect}
              disabled={acting}
              className="inline-flex items-center gap-1.5 text-xs text-brand border border-arc-400/40 hover:border-arc-400/70 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              <Brain className="w-3.5 h-3.5" aria-hidden />
              Dissect
            </button>
          </LearningHint>
          {/* Coach — promoted to the top toolbar (founder 2026-07-24). This is the SAME grade-a-draft
              Coach as the bottom-bar "Ask Coach" (same AskCoachCarePanel, same ask-coach route) — it was
              buried + greyed in the composer bar, so it's surfaced here alongside Summarize/Dissect for
              parity with the demo. A21: same feature, ONE backend, two entry points (not two features).
              Unlike Summarize/Dissect (which read the CONVERSATION), Coach grades the agent's reply DRAFT,
              so onCoach focuses the composer + hints when the draft is empty instead of silently greying —
              making the draft-dependency obvious (§ founder directive) rather than hidden behind a disabled
              state. */}
          {/* Coach grades a reply DRAFT, and there is NO composer on a closed conversation (the
              Composer is guarded `status !== "closed"`). So hide Coach on closed too — otherwise
              clicking it hits the empty-draft branch, focuses a null composer ref (no-op), and points
              the "type your reply first" hint at a composer that does not exist (audit 2026-07-24: I
              introduced this inert state when promoting Coach to the toolbar). Summarize/Dissect stay
              on closed — they read the CONVERSATION, not a draft. Matches the Decision-Dialogue guard. */}
          {conversation.status !== "closed" && (
          <LearningHint
            category="AI · Coach"
            title="Coach"
            whatItIs="The same Coach as 'Ask Coach' in the composer bar — a pre-send review of your reply DRAFT using Coach v5 (grounded in 10 books of communication principles). Returns a classification, a suggested revision with the cited principle + book, and conversational follow-up."
            why="Promoted here so the Coach is visible alongside Summarize and Dissect, not buried in the composer. It grades what YOU are about to send — so it needs a draft. Type your reply first, then Coach checks it before it goes out, when fixing costs one sentence."
            how="Type your reply in the composer, then click Coach. If the draft is empty, Coach points you to the composer to write it first. Read the diagnostic + suggested revision (with its book), use it, edit it, or send as-is — the Coach informs, you decide."
            principle="Coach grades your draft, not the conversation — that's why it needs your reply first. Same tool as 'Ask Coach'; this is just a more visible way in."
          >
            <button
              type="button"
              onClick={onCoach}
              disabled={acting}
              title="Grades your reply draft against the communication books — type your reply first, then click."
              className="inline-flex items-center gap-1.5 text-xs text-brand border border-arc-400/40 hover:border-arc-400/70 disabled:opacity-50 px-3 py-1.5 rounded-md"
            >
              <GraduationCap className="w-3.5 h-3.5" aria-hidden />
              Coach
            </button>
          </LearningHint>
          )}
          {/* Open as Decision Dialogue — escalates a tough
              customer case to the §3.1 structured internal call.
              Routes to /dashboard/decisions?fromCareConversation=<id>;
              that page fetches the decision-seed endpoint and pre-loads
              the Situation phase with the customer's actual words. (Was a
              dead link to a non-existent /dashboard/decisions/new — fixed
              2026-07-24.) Full inline-in-thread integration remains a
              follow-up. */}
          {/* Decision Dialogue — grouped inside Agent Tools (founder 2026-07-25). */}
          {conversation.status !== "closed" && (
            <LearningHint
              category="C.A.R.E · §3.3"
              title="Open as Decision Dialogue"
              whatItIs="Escalates this customer conversation into a structured internal Decision Dialogue with the conversation's context pre-loaded. The Dialogue takes you through Situation → Your Read → System Response → Decide, with reasoning captured at each phase."
              why="Some customer issues aren't 'reply to this customer' work — they're 'figure out the actual call' work. A refund policy edge case. A bug we don't know whether to fix or document. A request that surfaces a product gap. Decision Dialogue is the structured frame for those — it forces the team to state their diagnosis BEFORE the System weighs in, then captures the reasoning on the record. The dialogue carries the customer's actual words with it so the team's decision stays grounded in what was asked."
              how="Click when the right next move isn't obvious from inside the support frame. The Dialogue opens with the conversation context as the seed. Walk through the phases with whoever else needs to be in the call. Your reply to the customer comes out of the Dialogue's chosen path — not before it."
              principle="If you're about to reply to a customer with a decision you haven't actually made, escalate. The Dialogue exists for the calls that deserve more than an in-the-moment response."
            >
              <Link
                href={`/dashboard/decisions?fromCareConversation=${conversation.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-brand border border-ember-400/40 hover:border-ember-400/70 disabled:opacity-50 px-3 py-1.5 rounded-md"
              >
                <Brain className="w-3.5 h-3.5" aria-hidden />
                Open as Decision Dialogue
              </Link>
            </LearningHint>
          )}
            </>
          )}
          {conversation.aiResponding && (
            <LearningHint
              category="C.A.R.E · Take over"
              title="Take over"
              whatItIs="Claims this conversation for YOU (the signed-in agent). Replaces the AI as the active responder — any drafted-but-unsent AI reply is discarded; the conversation moves into your queue. Shorthand for 'assign to me' when an AI-handled conversation needs a human."
              why="C.A.R.E's first-line responder for most conversations is the AI. Most of the time that's the right shape — the AI handles tier-1 questions fast and well. But some conversations need a human read: emotional weight, edge cases, anything where empathy is part of the response. Take over is the structural transfer."
              how="Click when you see a conversation that needs you specifically. The AI stops; you become the assignee; the customer is told (via a system message) that a human is now responding. Once you've taken over, use the composer to reply."
              principle="The AI handles the volume; the human handles the nuance. Take over is the structural seam between those modes."
            >
              <button
                type="button"
                onClick={onClaim}
                disabled={acting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-ember-400/10 border border-ember-400/40 hover:border-ember-400/70 hover:bg-ember-400/15 disabled:opacity-50 px-3 py-1.5 rounded-md"
              >
                <UserCheck className="w-3.5 h-3.5" aria-hidden />
                Take over
              </button>
            </LearningHint>
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
          {/* Supervisor guidance toggle — flag-ON (need help) or
              flag-OFF (resolved). Visible:
                - On any non-closed conversation (the normal flag
                  / clear workflow).
                - On closed conversations ONLY IF a flag is
                  currently set, so it can be cleared. Without
                  this exception, a closed conversation with a
                  lingering flag would sit in the "Needs guidance"
                  view forever with no clearing path. */}
          {(conversation.status !== "closed" ||
            conversation.supervisorGuidanceRequestedAt) && (
            <LearningHint
              category="C.A.R.E · §A18"
              title="Request guidance"
              whatItIs="Flags this conversation as needing supervisor input. The Needs guidance count on the Command Center increments; admins (CEO / COO / admin) get a notification in the inbox; the conversation surfaces in the Needs guidance filter. Click again to clear the flag once guidance has landed."
              why="Tribal escalation (DM the senior agent) produces two failures: it depends on social capital, and it leaves no record. A structural request routes the ask through the chain — audited, attributable, visible at the leadership level. The leader can answer in the conversation thread or in person; either way, the flag becomes part of the record. Per §A18 the surface is invitation-shaped: the agent is asking, not failing."
              how="Click when the next move isn't obvious to you AND it deserves a senior eye before you reply. Internal notes are for context capture; this is for routing attention. Don't use it for every hard case — that defeats the signal. Use it when you're about to send something you don't trust yet."
              principle="Asking for guidance is a strength signal, not a weakness one. A team where the request is structural produces fewer mistakes than a team where it's tribal."
            >
              <button
                type="button"
                onClick={onToggleGuidance}
                disabled={acting}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors ${
                  conversation.supervisorGuidanceRequestedAt
                    ? "text-amber-700 dark:text-amber-300 bg-amber-400/10 border border-amber-400/50 hover:bg-amber-400/15"
                    : "text-secondary border border-default hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-400/50"
                }`}
              >
                <HandHelping className="w-3.5 h-3.5" aria-hidden />
                {conversation.supervisorGuidanceRequestedAt
                  ? "Guidance requested"
                  : "Request guidance"}
              </button>
            </LearningHint>
          )}
          {conversation.status !== "resolved" &&
            conversation.status !== "closed" && (
              <LearningHint
                category="C.A.R.E · §3.5"
                title="Resolve"
                whatItIs="Marks the conversation as resolved and opens the resolution capture form: 'What was the actual issue?' and 'What worked?' Optional category, optional precedent link. The capture creates a row in support_resolutions and schedules a §3.5 durability check 7 days out."
                why="Closing a ticket without recording the reasoning is the failure mode every support tool ships. The team loses what worked, the customer's case becomes invisible to the next agent who hits the same shape, and 'durability' becomes an aspirational word in a quarterly review. Resolve captures the institutional memory in the agent's voice, in the moment, before the context evaporates."
                how="Click when the customer's issue is actually addressed. Write the issue summary in your own words (not the customer's complaint verbatim — your read of what was actually going on). Write what worked, with enough detail that the next agent could apply it. Tag with a category if a pattern fits — those tags drive the Patterns surface."
                principle="A resolution without a stated WHY is incomplete. The reasoning is the transferable asset; the closure is just its current expression."
              >
                <button
                  type="button"
                  onClick={onResolve}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 disabled:opacity-50 px-3 py-1.5 rounded-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                  Resolve
                </button>
              </LearningHint>
            )}
          {/* Close (archive without resolution) is secondary to Resolve — Expert-only
              in Standard, where Resolve is the one primary terminal action (§3.4). */}
          {conversation.status !== "closed" && !isStandard && (
            <LearningHint
              category="C.A.R.E"
              title="Close"
              whatItIs="Archives the conversation without capturing a resolution. The conversation drops out of active inbox views but remains in the record. Distinct from Resolve — Close does NOT trigger the §3.5 durability check because no resolution was claimed."
              why="Sometimes a conversation ends without a 'resolution' in any meaningful sense — the customer ghosted, the issue turned out to be on their end, the conversation was spam, the customer found the answer themselves. Forcing every closure through the resolution flow would corrupt the resolution corpus with non-data. Close is the honest path for these."
              how="Use Close when there's nothing real to capture. Use Resolve when something actually was resolved and the reasoning is worth recording. If you're tempted to Close to skip the resolution form on a real resolution — don't. The Resolve capture is more valuable than the closure itself; that's why it's there."
              principle="Closing without recording is appropriate when there's nothing to record. It's never appropriate as a shortcut around the discipline."
            >
              <button
                type="button"
                onClick={onClose}
                disabled={acting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary border border-default hover:text-red-700 dark:hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/5 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden />
                Close
              </button>
            </LearningHint>
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const current = team.find((t) => t.id === currentAssignedId);
  const label = current?.fullName ?? "Assign";
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={acting}
        // a11y: announce the popup + its state to screen readers (matches the CareShell status trigger
        // pattern). Additive only — no behavioral change. Full menu keyboard-nav is the deferred A1 work
        // in docs/audits/2026-07-24-care-accessibility-audit.md.
        aria-haspopup="true"
        aria-expanded={open}
        title="Assign or hand off this conversation"
        className="inline-flex items-center gap-1.5 text-xs text-secondary border border-default hover:text-brand hover:border-arc-400/50 disabled:opacity-50 px-3 py-1.5 rounded-md transition-colors"
      >
        <UserCheck className="w-3.5 h-3.5" aria-hidden />
        {current ? `Assigned: ${label}` : "Assign"}
      </button>
      <FloatingMenu
        open={open}
        anchorRef={triggerRef}
        placement="bottom-end"
        onClose={() => setOpen(false)}
        minWidth={256}
        // z-index MUST clear CareShell. This whole surface renders inside CareShell's root, which is
        // `fixed inset-0 z-[60]` with an OPAQUE bg-base. FloatingMenu portals to document.body, so the
        // menu becomes a SIBLING of that z-60 shell — at the old z-50 it opened INVISIBLY BEHIND the
        // opaque shell and could not be clicked ("Assign does nothing" — the real cause; the earlier
        // `relative z-10` toolbar fixes were the wrong layer). 70 matches the other above-shell care
        // overlays (toast z-70) and stays below the z-80 resolution modal. (audit 2026-07-24)
        zIndex={70}
        className="max-h-80 overflow-y-auto bg-base border border-default rounded-md shadow-lg py-1"
      >
        {currentAssignedId && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAssign(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-700 dark:text-red-300 hover:bg-red-500/5"
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
                  ? "bg-arc-400/5 text-brand cursor-default"
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
      </FloatingMenu>
    </>
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cur = priorityDisplay(current);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        // a11y: additive only. aria-label because the visible text alone ("NORMAL") doesn't convey this
        // is a control; aria-haspopup/expanded announce the popup + its state (matches CareShell status).
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Change priority (currently ${cur.label})`}
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${cur.tone.chip}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cur.tone.dot}`} />
        {cur.label}
      </button>
      <FloatingMenu
        open={open}
        anchorRef={triggerRef}
        placement="bottom-start"
        onClose={() => setOpen(false)}
        minWidth={120}
        // Same CareShell-stacking fix as the Assign dropdown: portaled to body, so it must clear the
        // z-60 opaque shell or it opens invisibly behind it. z-70 (audit 2026-07-24).
        zIndex={70}
        className="bg-base border border-default rounded-md shadow-lg py-1"
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
      </FloatingMenu>
    </>
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

  // Per user feedback 2026-06-18 — agent + customer message bodies
  // were rendering too dim in dark mode. The 4%-opacity amber/white
  // tints made the bubble nearly invisible against bg-base, and the
  // text-primary inside read as faded because the bubble itself had
  // no visual presence. Switched to bg-surface-raised (the proper
  // card-on-card surface token) so message bodies have a solid base
  // and full contrast in both modes. Tone color is preserved via
  // the border accent only — that's where the speaker semantic lives.
  const tone = isNote
    ? "border-accent-text/40 bg-surface-raised"
    : isCustomer
      ? "border-default bg-surface-raised"
      : isAi
        ? "border-arc-400/40 bg-surface-raised"
        : "border-ember-400/40 bg-surface-raised";

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
      {message.kind === "attachment" && message.mediaUrl ? (
        <InlineAttachment
          mediaUrl={message.mediaUrl}
          mediaType={message.mediaType ?? null}
          fallbackTitle={message.body}
        />
      ) : (
        <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
          {message.body}
        </p>
      )}
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
        <div className="mt-2 pt-2 border-t border-ember-400/20">
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
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:text-ember-400 border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 px-2 py-0.5 rounded transition-colors"
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
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">
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
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
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
            ? "text-emerald-700 dark:text-emerald-300"
            : grade === "needs_guidance"
              ? "text-amber-700 dark:text-amber-300"
              : "text-secondary"
        }`}
        aria-hidden
      />
      <div className="flex-1">
        <span
          className={`text-[10px] uppercase tracking-widest font-bold ${
            grade === "productive"
              ? "text-emerald-700 dark:text-emerald-300"
              : grade === "needs_guidance"
                ? "text-amber-700 dark:text-amber-300"
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
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:text-ember-400 border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 px-2 py-0.5 rounded transition-colors"
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
  aiPrecedents,
  composerRef,
  conversationId,
  onSpawnTask,
  onFormulate,
  onAskCoach,
  onSummarize,
  onAssetUploaded,
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
  aiPrecedents: Array<{
    id: string;
    issueSummary: string;
    category: string | null;
    whatWorked: string;
  }>;
  composerRef: React.RefObject<HTMLTextAreaElement | null>;
  conversationId: string;
  onSpawnTask: () => void;
  onFormulate: () => void;
  onAskCoach: () => void;
  onSummarize: () => void;
  onAssetUploaded?: () => void;
  isEmailChannel?: boolean;
}) {
  // Standard: relocate Formulate (a "shape my stated intent" tool that overlaps AI
  // Co-Pilot) to Expert — Co-Pilot + Ask Coach are the primary AI in Standard (§3.3
  // declutter). Expert shows all composer tools as today (§6).
  const { isStandard } = useExperienceMode();
  return (
    <div className="border-t border-default bg-white/[0.02] px-4 md:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* Tool buttons — horizontal scroll instead of vertical wrap
          per 2026-06-22 layout bug report. When the Detail pane is
          narrow (Customer pane open on a typical laptop), flex-wrap
          stacked each button to its own row, making the composer
          unusable. Horizontal scroll keeps every tool reachable in
          one row; touch-pan-x + hidden scrollbar make it feel native. */}
      <div className="relative z-10 flex items-center gap-1.5 mb-2 overflow-x-auto flex-nowrap [&>*]:shrink-0 [touch-action:pan-x] [overscroll-behavior:contain] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <LearningHint
          category="C.A.R.E"
          title="Reply mode"
          whatItIs="Composes a message that goes to the customer. The standard mode for any agent-to-customer communication."
          why="Support conversations are a high-stakes channel — the customer is in your product, often frustrated, and what you say lands in their inbox or chat. The composer separates Reply from Internal note structurally so it's impossible to accidentally send an internal observation to the customer."
          how="Default to Reply. Type the message you want the customer to receive. Use the AI tools (Formulate, Co-pilot) to shape it. Ask Coach checks it before send. The customer sees only what you compose here."
          principle="The channel boundary is enforced by the System, not by your memory. If something is for the customer, write it here. If it's not, switch to Internal note."
        >
          <button
            type="button"
            onClick={() => onToggleNote(false)}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
              !isInternalNote
                ? "text-brand border-ember-400/40 bg-ember-400/10"
                : "text-muted border-default hover:border-strong"
            }`}
          >
            Reply
          </button>
        </LearningHint>

        <LearningHint
          category="C.A.R.E"
          title="Internal note"
          whatItIs="Composes a note visible only to your team — the customer never sees it. Use it to capture context, hand off to a teammate, or record reasoning you'll need later."
          why="Tribal knowledge in support is the failure mode every team eventually pays for: the senior agent who handled this customer six months ago leaves, and the team rediscovers the same context from scratch. Internal notes become permanent record on the conversation, so future agents (and future-you) have the reasoning intact."
          how="Switch to Internal note when you want to record what you tried, why you handed it off, the customer's tone, or anything else that informs the next move. Notes thread with the conversation — they sit alongside customer messages in the timeline but are styled distinctly so no agent confuses them with a sent reply."
          principle="Every observation worth having is worth recording. The conversation history is the team's institutional memory; notes turn what's in your head into what's in the System."
        >
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
        </LearningHint>

        <div className="flex-1" />
        {!isInternalNote && (
          <>
            {/* Summarize — moved down to the composer with the reply-flow tools
                (founder 2026-07-25): Summarize · AI Co-Pilot · Ask Coach · Spawn Task. */}
            <LearningHint
              category="AI · C.A.R.E"
              title="Summarize"
              whatItIs="The System's read of this conversation so far — what the customer is asking, what's been tried, and what's still open."
              why="Long threads accumulate noise; Summarize collapses the catch-up cost so you can act."
              how="Click when the thread is long or unfamiliar, then confirm or correct the read against the conversation itself."
              principle="A summary is the System's read, not an instruction — confirm or correct it."
            >
              <button
                type="button"
                onClick={onSummarize}
                className="text-[11px] font-semibold text-secondary border border-default hover:border-strong hover:text-primary inline-flex items-center gap-1 px-2 py-0.5 rounded"
              >
                <Sparkles className="w-3 h-3" aria-hidden />
                Summarize
              </button>
            </LearningHint>
            {!isStandard && (
            <LearningHint
              category="AI · C.A.R.E"
              title="Formulate C.A.R.E"
              whatItIs="You tell the System what you want to communicate (one or two sentences of intent), and it shapes that intent into a clear, warm customer-facing reply in the C.A.R.E voice."
              why="Sometimes you know exactly what to say but don't have the words yet — the right opening, the right level of acknowledgment, the right close. Formulate keeps you in the driver's seat (you provide the substance) while the System handles the prose. This is different from AI Co-Pilot: Co-Pilot drafts unprompted; Formulate shapes your stated intent."
              how={`Click, write your intent ("tell them the refund will land in 5-7 business days, acknowledge the wait was longer than usual, offer to follow up if it doesn't arrive"), and the System returns a polished draft. Edit before sending — it's a starting point, not a final word.`}
              principle="Tools that draft for you risk replacing your judgment. Tools that shape your intent strengthen it. Formulate is the second kind."
            >
              <button
                type="button"
                onClick={onFormulate}
                className="text-[11px] font-semibold text-secondary border border-default hover:border-strong hover:text-primary inline-flex items-center gap-1 px-2 py-0.5 rounded"
              >
                <Lightbulb className="w-3 h-3" aria-hidden />
                Formulate C.A.R.E
              </button>
            </LearningHint>
            )}

            {/* Order per founder 2026-07-25: Summarize · AI Co-Pilot · Ask Coach ·
                Spawn Task. Co-Pilot (draft-from-scratch) precedes Ask Coach
                (review-what-you-drafted) because that's the actual workflow order —
                you draft, then you check. */}
            <LearningHint
              category="AI · C.A.R.E"
              title="AI Co-pilot"
              whatItIs="Drafts a customer reply from scratch using the conversation context, product context, and the company's past resolutions. Surfaces WHICH precedents it drew from so you can verify the System is generalizing from real prior work, not guessing."
              why="The agent who has handled this kind of issue 14 times before drafts a confident response in 30 seconds. The agent who's seen it once spends 5 minutes. Co-Pilot evens that out — it surfaces the company's institutional memory the moment you start a reply, so a new agent gets the senior agent's pattern recognition. Brain-gated: silent during the month-1 control window so the System learns the team's baseline voice before it starts shaping replies."
              how="Click after the customer has sent at least one message. Co-Pilot returns a draft you can use as-is, edit, or discard. The precedents it drew from appear below the composer — open them and verify they're real cases that actually match. If they don't, the draft probably misses the mark."
              principle="An AI draft you can't verify is an AI draft you can't trust. Co-Pilot shows its work so you can judge whether the generalization is fair before you send."
            >
              <button
                type="button"
                onClick={onAiCoPilot}
                disabled={aiDrafting}
                className="text-[11px] font-semibold text-brand border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 disabled:opacity-50 inline-flex items-center gap-1 px-2 py-0.5 rounded"
              >
                {aiDrafting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" aria-hidden />
                )}
                AI Co-pilot
              </button>
            </LearningHint>

            <LearningHint
              category="AI · Coach"
              title="Ask Coach"
              whatItIs="Pre-send review of your draft using Coach v5 — the LLM-primary communication coach grounded in 10 books of operational communication principles (Voss, Carnegie, Heath, Zinsser, Rosenberg, others). Returns a classification, a suggested revision with explicit source citation, and conversational follow-up."
              why="The same risks show up in support replies again and again: unsupported absolutes, fabricated specifics (the agent invents a feature or policy the product doesn't actually have), empty filler that delays the actual answer. The Coach is calibrated to surface these BEFORE send, when the cost of fixing is editing one sentence — not after, when the cost is a customer who reads the fabricated specific as a promise."
              how="Type your draft. Click Ask Coach. Read the diagnostic (what the Coach noticed) and the suggested revision (with the principle and book it's drawing from). Use the revision, edit it further, or dismiss and send as-is. The Coach informs; you decide."
              principle="The Coach never sends. Its job is to surface the risk you can't see in your own draft. Yours is to decide whether the risk is real and what to do about it."
            >
              <button
                type="button"
                onClick={onAskCoach}
                disabled={!draft.trim()}
                className="text-[11px] font-semibold text-brand border border-arc-400/40 hover:border-arc-400/70 bg-arc-400/5 hover:bg-arc-400/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 px-2 py-0.5 rounded"
              >
                <Wand2 className="w-3 h-3" aria-hidden />
                Ask Coach
              </button>
            </LearningHint>

            <LearningHint
              category="C.A.R.E · Composition"
              title="Spawn task"
              whatItIs="Turns this conversation into a structured task in the Operations board. Carries the conversation context with it so the task owner has the full thread, not just a one-line description."
              why="Customer conversations regularly surface work that doesn't belong in the customer reply — a bug to fix, a docs page to update, a process to revisit. Without Spawn task, that work either disappears into a Slack message someone forgets to act on or gets crammed awkwardly into the support reply. With it, the work lands in Operations with the full thread attached, and the support agent gets back to the customer with the right message."
              how="Click Spawn task. Add a title and any extra context the conversation doesn't already capture. The new task appears in Operations, linked back to this conversation so future viewers can trace the origin. The conversation can resolve independently — the task lives on its own track."
              principle="Conversations and work are different units. The conversation is closed when the customer is satisfied. The work is closed when the underlying issue is resolved. Treat them as separate so neither blocks the other."
            >
              <button
                type="button"
                onClick={onSpawnTask}
                className="text-[11px] font-semibold text-brand border border-arc-400/40 hover:border-arc-400/70 bg-arc-400/5 hover:bg-arc-400/10 inline-flex items-center gap-1 px-2 py-0.5 rounded"
              >
                <ListChecks className="w-3 h-3" aria-hidden />
                Spawn task
              </button>
            </LearningHint>
            {/* Asset System v1 — Phase 4 C.A.R.E composer
                integration. The agent-upload endpoint atomically
                writes the file row AND posts an attachment-kind
                support_messages row so the file is visible
                inline in the thread (not only via library). */}
            <FileDropzone
              hiddenLabel
              endpoint={`/api/care/conversations/${conversationId}/agent-upload`}
              onUploadComplete={(r) => {
                if (r.ok) onAssetUploaded?.();
              }}
            />
          </>
        )}
      </div>
      {/* Standard (0110): the draft below is primary; the co-pilot's internal
          reasoning is supplementary — hidden in Standard, shown in Expert. */}
      <ExpertOnly>
        {aiReasoning && (
          <div className="mb-2 p-2 rounded-md border border-arc-400/30 bg-arc-400/[0.04] text-[11px] text-brand leading-relaxed">
            <span className="font-semibold">Co-pilot reasoning (internal):</span>{" "}
            {aiReasoning}
          </div>
        )}
      </ExpertOnly>
      {/* §3.6 make-learning-visible — the precedents the Co-Pilot drew
          from. Surfaced so the agent can verify they're real cases and
          judge whether the System's generalization is fair (§3.3). Per
          TT.md A21 audit MED fix (2026-06-18). */}
      {/* §3.6 make-learning-visible (the precedents the co-pilot drew on) — a
          Standard user still gets it, ONE CLICK away, never fully hidden (self-audit
          2026-07-10: §3.6 content uses AdvancedDetail, not ExpertOnly, so Standard
          doesn't lose the evidence the System is learning). Expert shows it inline. */}
      {aiPrecedents.length > 0 && (
        <AdvancedDetail
          className="mb-2"
          label={`Show ${aiPrecedents.length} precedent${
            aiPrecedents.length === 1 ? "" : "s"
          } the co-pilot drew on`}
        >
          <div className="mb-2 p-2 rounded-md border border-arc-400/30 bg-arc-400/[0.02] text-[11px] text-brand leading-relaxed">
            <p className="font-semibold mb-1">
              Drew on {aiPrecedents.length} past resolution
              {aiPrecedents.length === 1 ? "" : "s"}:
            </p>
            <ul className="space-y-0.5">
              {aiPrecedents.map((p) => (
                <li key={p.id} className="text-secondary">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted mr-1.5">
                    {p.category ?? "uncat"}
                  </span>
                  {p.issueSummary.length > 80
                    ? p.issueSummary.slice(0, 77) + "…"
                    : p.issueSummary}
                </li>
              ))}
            </ul>
          </div>
        </AdvancedDetail>
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
              : "Type your reply… (Cmd/Ctrl+Enter to send)"
          }
          rows={3}
          disabled={sending}
          aria-label={
            isInternalNote
              ? "Internal note. Cmd/Ctrl+Enter to send."
              : "Reply to customer. Cmd/Ctrl+Enter to send."
          }
          // Min-h ensures the composer keeps a sensible size when
          // the mobile keyboard occupies the lower half of the
          // viewport. resize-y still allows the agent to drag the
          // textarea taller.
          className={`flex-1 min-w-0 min-h-[5rem] bg-base border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none resize-y leading-relaxed ${
            isInternalNote
              ? "border-accent-text/30 focus:border-accent-text/50"
              : "border-default focus:border-strong"
          }`}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !draft.trim()}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] px-3 py-2 rounded-md"
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

/**
 * Sticky bulk-action bar — appears above the conversation list
 * when the agent has checkbox-selected ≥1 row. Three actions
 * mirror the single-conversation header (Assign / Archive (or
 * Reopen if viewing Closed) / Clear).
 *
 * Per AMD-006 §1.5.1 layer 4: same vocabulary as per-row
 * actions, so the agent doesn't switch mental models when
 * scaling from one to many.
 */
function BulkActionBar({
  count,
  team,
  currentUserId,
  viewKey,
  acting,
  onClear,
  onArchive,
  onReopen,
  onAssign,
}: {
  count: number;
  team: Array<{
    id: string;
    fullName: string | null;
    role: string | null;
    isSupportAgent: boolean;
  }>;
  currentUserId: string | null;
  viewKey: ViewKey;
  acting: boolean;
  onClear: () => void;
  onArchive: () => void;
  onReopen: () => void;
  onAssign: (targetAgentId: string | null) => void;
}) {
  // Swap Archive → Reopen for any terminal view (closed OR
  // resolved). Bug fix: previously only `closed` triggered the
  // swap, so bulk-archive on the Resolved view silently
  // transitioned resolved → closed for every selected item,
  // burying the captured resolution semantics. Resolved + Closed
  // are both "terminal — no further action expected from this
  // surface"; the only sensible bulk action is the reverse
  // direction (Reopen).
  const isTerminalView = viewKey === "closed" || viewKey === "resolved";
  return (
    <LearningHint
      as="block"
      category="C.A.R.E · Bulk"
      title="Bulk action bar"
      whatItIs="A sticky-top action bar that appears whenever you've selected ≥1 conversation via the row checkboxes. Shows the selection count + bulk actions (Assign / Close OR Reopen depending on the view). The Clear button drops the selection without acting."
      why="Operating C.A.R.E one conversation at a time is fine until you hit a wave (spam, broken integration affecting many customers, a triage backlog). The bulk affordances exist for the wave case. The two-step confirm on Close (matched by the actual button) is the structural defense against accidental mass-close."
      how="Check the rows you want to act on. The bar appears. Pick the action. For terminal views (Closed/Resolved) you get Reopen; for active views you get Close (with the two-step confirm). Clear drops the selection if you change your mind. Selections clear automatically when you switch views — stale selections would be confusing."
      principle="Bulk affordances reward leverage AND require structural safeguards. The two-step confirm + auto-clear are both about safety, not friction."
    >
    <div className="px-3 py-2 border-b border-default bg-ember-400/[0.06] flex items-center gap-2 sticky top-0 z-10">
      <span className="text-xs font-semibold text-brand">
        {count} selected
      </span>
      <span className="text-muted text-xs">·</span>
      {team.length > 0 && (
        <AssignDropdown
          team={team}
          currentAssignedId={null}
          currentUserId={currentUserId}
          acting={acting}
          onAssign={onAssign}
        />
      )}
      {isTerminalView ? (
        <LearningHint
          category="C.A.R.E · Bulk reopen"
          title="Reopen"
          whatItIs="Moves every selected closed/resolved conversation BACK to open. Useful when the customer's reply comes in after the agent closed the thread, or when a 'resolved' state turns out not to have held."
          why="Conversations aren't permanently closed — customers can always reply and reopen via that path. The bulk reopen is the agent-side reverse: when you realize a batch of conversations was closed prematurely, you can put them back in the queue without one-by-one work."
          how="From a terminal-view filter (Closed or Resolved), select the conversations. Click Reopen. They reappear in the active queue and the agent who owns them gets a notification."
          principle="Closure is a state, not an end. Reopening is the structural acknowledgment that the agent's earlier judgment turned out wrong."
        >
          <button
            type="button"
            onClick={onReopen}
            disabled={acting}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/70 disabled:opacity-50 px-2.5 py-1 rounded-md"
          >
            Reopen
          </button>
        </LearningHint>
      ) : (
        <BulkCloseButton
          count={count}
          acting={acting}
          onConfirm={onArchive}
        />
      )}
      <LearningHint
        category="C.A.R.E · Bulk"
        title="Clear selection"
        whatItIs="Drops the current bulk selection without performing any action. The conversations stay in whatever state they were in; only the checkbox state resets."
        why="Without an explicit Clear, the agent's only way to drop the selection would be to uncheck every row one at a time. Clear is the structural exit from bulk mode if you change your mind."
        how="Click to drop the selection. The bulk action bar disappears. The view returns to single-conversation operation."
        principle="A reversible action shouldn't require effortful reversal. Clear is the single-click exit."
      >
        <button
          type="button"
          onClick={onClear}
          disabled={acting}
          className="ml-auto text-[11px] text-muted hover:text-primary px-2 py-1 rounded"
        >
          Clear
        </button>
      </LearningHint>
    </div>
    </LearningHint>
  );
}

/**
 * BulkCloseButton — two-step confirm for bulk close action.
 *
 * Single-conversation Close has its own modal/confirm chain.
 * Bulk Close fires on a multi-row selection — accidental click can
 * close several conversations at once. The two-step pattern (Close
 * → "Confirm close N?") is the lightest weight defense; no modal
 * stack, no scroll, just a visible state shift on the same button.
 *
 * Per Wave AG (2026-06-19) audit response.
 */
function BulkCloseButton({
  count,
  acting,
  onConfirm,
}: {
  count: number;
  acting: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirming]);
  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          disabled={acting}
          className="inline-flex items-center gap-1.5 text-xs text-primary bg-red-500/15 border border-red-500/60 hover:bg-red-500/25 disabled:opacity-50 px-2.5 py-1 rounded-md font-semibold"
        >
          <Lock className="w-3.5 h-3.5" aria-hidden />
          Confirm close {count}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={acting}
          className="text-[11px] text-muted hover:text-primary px-2 py-1 rounded"
        >
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={acting}
      title={`Close ${count} conversation${count === 1 ? "" : "s"} — soft archive, customer can reopen by replying`}
      className="inline-flex items-center gap-1.5 text-xs text-secondary border border-default hover:text-red-700 dark:hover:text-red-300 hover:border-red-500/50 disabled:opacity-50 px-2.5 py-1 rounded-md"
    >
      <Lock className="w-3.5 h-3.5" aria-hidden />
      Close
    </button>
  );
}

/**
 * Thin vertical rail shown in place of a collapsed panel. Single
 * job: be tappable so the panel comes back. Width is kept tight
 * (24px) to maximize the conversation pane the agent just freed.
 *
 * chevronDir: "right" (default) for left-side panels collapsing
 * leftward — the rail's chevron points right ("expand outward").
 * "left" for the right-side customer panel — chevron points left.
 *
 * Per AMD-006 §1.5.1 layer 3 (composition): the rail is the
 * affordance that keeps "collapsed" reversible. Without it the
 * panel would feel gone, not hidden.
 */
function CollapsedRail({
  ariaLabel,
  onExpand,
  chevronDir = "right",
}: {
  ariaLabel: string;
  onExpand: () => void;
  chevronDir?: "left" | "right";
}) {
  const Chevron = chevronDir === "left" ? ChevronLeft : ChevronRight;
  // chevronDir="right" = collapsed panel on the LEFT side → rail
  // needs its border on the RIGHT (separating from neighbor pane).
  // chevronDir="left"  = collapsed panel on the RIGHT side → rail
  // needs its border on the LEFT.
  const borderClass =
    chevronDir === "left"
      ? "border-l border-ember-400/40"
      : "border-r border-ember-400/40";
  // The rail is the only affordance back to a collapsed panel.
  // The earlier muted-gray look made it nearly invisible against
  // the dark surface — users couldn't find their way back.
  // Brand-accent tint + brighter chevron makes it a real
  // doorway, not a vestigial 1px stripe.
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`w-6 flex-shrink-0 ${borderClass} bg-ember-400/[0.08] hover:bg-ember-400/20 flex items-center justify-center text-brand hover:text-primary transition-colors`}
    >
      <Chevron className="w-4 h-4" aria-hidden />
    </button>
  );
}

/** Machine concern value → readable label (audit A5, AMD-006 Layer 4). "account_login" → "Account login". */
function humanizeConcern(topic: string): string {
  const t = topic.replace(/_/g, " ").trim();
  return t.length === 0 ? t : t.charAt(0).toUpperCase() + t.slice(1);
}

function CustomerPanel({
  conversation,
  events,
  width,
  onCollapse,
}: {
  conversation: Conversation;
  events: ConversationEvent[];
  width: number;
  onCollapse: () => void;
}) {
  const customer = conversation.customer;
  // §A11 mirror — counts observed across this customer's conversations (3c aggregator).
  // Counts only, never verdicts; threshold-gated server-side (§3.2). Null until loaded.
  const [patterns, setPatterns] = useState<{
    totalConversations: number;
    resolvedConversations: number;
    topConcerns: Array<{ topic: string; count: number }>;
    enoughData: boolean;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPatterns(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/care/conversations/${conversation.id}/customer-patterns`
        );
        if (res.ok && !cancelled) setPatterns(await res.json());
      } catch {
        /* leave null → honest 'need more data' fallback renders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation.id]);
  return (
    <aside
      // Mobile: full-width drawer. md+: persisted user width via
      // CSS variable so resize handle still works on desktop.
      style={{ "--care-customer-w": `${width}px` } as React.CSSProperties}
      className="flex-shrink-0 border-l border-default bg-white/[0.01] flex flex-col w-full md:w-[var(--care-customer-w)]"
    >
      <div className="px-5 py-4 border-b border-default">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted">
            Customer
          </p>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse customer panel"
            title="Collapse"
            className="text-muted hover:text-primary p-1 -mt-1 -mr-1 rounded hover:bg-white/[0.04] shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
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

      {/* §A11 mirror panel — counts the System has observed about this
          customer across their conversation history. Never verdicts;
          withheld until enough conversations exist (§3.2). Wired to the
          real aggregator 2026-07-24 (GET .../customer-patterns). */}
      <div className="px-5 py-3 border-b border-default">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-2">
          What we&apos;ve noticed
        </p>
        {patterns && patterns.enoughData ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-3">
              <span className="text-[11px] text-secondary">
                <span className="text-primary font-semibold">
                  {patterns.totalConversations}
                </span>{" "}
                conversations
              </span>
              <span className="text-[11px] text-secondary">
                <span className="text-primary font-semibold">
                  {patterns.resolvedConversations}
                </span>{" "}
                resolved
              </span>
            </div>
            {patterns.topConcerns.length > 0 && (
              <div>
                <p className="text-[10px] text-muted mb-1">Recurring concerns</p>
                <ul className="flex flex-wrap gap-1.5">
                  {patterns.topConcerns.map((c) => (
                    <li
                      key={c.topic}
                      className="text-[10px] text-secondary bg-white/[0.04] border border-default rounded-full px-2 py-0.5"
                    >
                      {humanizeConcern(c.topic)} · {c.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-muted italic leading-relaxed">
              Counts across this customer&apos;s history — not a verdict about
              them.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-secondary leading-relaxed italic">
            We need a few more conversations with this customer before
            surfacing patterns. The System refuses to assert about someone it
            hasn&apos;t observed enough.
          </p>
        )}
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
    case "ai_suppressed_loop":
      // Email AI first-responder hit the loop breaker — explains why the AI
      // went quiet on this thread (a mail-loop with the sender's auto-responder).
      return `AI paused — reply loop detected (${(e.metadata.recent_ai_replies as number) ?? "?"} auto-replies in a row)`;
    case "ai_suppressed_flood":
      return `AI paused — too many auto-replies to this sender (${(e.metadata.sender_ai_replies as number) ?? "?"} recently)`;
    case "ai_suppressed_automated":
      // The inbound was machine-generated (out-of-office, bounce, bulk/list) — the AI
      // deliberately didn't reply (RFC 3834). The reason is the greppable signal that fired.
      return `AI paused — automated sender, no auto-reply sent (${(e.metadata.reason as string) ?? "?"})`;
    default:
      // NOTE (verified 2026-07-24): the cases above are COMPLETE for every event_type actually
      // written to support_conversation_events — the 8 from the SQL triggers (0035/0039) plus the
      // 3 ai_suppressed_* from the inbound-email route. No current event reaches this default; it's
      // a defensive fallback for a future type someone forgets to label. (An earlier commit message
      // flagged resolved/reopened/closed/ai_assisted as falling through here — that was a grep
      // false-positive; those are not inserted into this table.)
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
      className="w-1 flex-shrink-0 bg-default/40 hover:bg-ember-400/40 active:bg-ember-400/60 cursor-col-resize transition-colors"
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
  type PriorSimilar = {
    id: string;
    issueSummary: string;
    category: string | null;
  };
  const [summary, setSummary] = useState<string | null>(null);
  const [priorSimilar, setPriorSimilar] = useState<PriorSimilar[]>([]);
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
        if (data.suppressed) {
          // §3.4 control window — surface the suppression
          // honestly. The summary field carries a guidance
          // message the agent can read while the System
          // baselines their reads.
          setSummary(data.summary ?? null);
          setError(null);
          return;
        }
        setSummary(data.summary ?? "");
        // Per TT.md A21 audit MED fix — §3.6 institutional
        // memory is now visible during summary, parallel to
        // chat's similar-topics surface.
        if (Array.isArray(data.priorSimilar)) {
          setPriorSimilar(data.priorSimilar as PriorSimilar[]);
        }
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
      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
      {summary && (
        <>
          <p className="text-xs uppercase tracking-widest text-muted font-bold mb-2">
            The System&apos;s read
          </p>
          <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
            {summary}
          </p>
          <ExpertOnly>
            <p className="text-[10px] text-muted italic mt-3">
              §3.3 — this is the System&apos;s read, not a verdict.
              Confirm or correct it against the conversation itself.
            </p>
          </ExpertOnly>
          {/* Experience Mode Standard (0110, Phase 3 render-layer): the summary
              above is the PRIMARY read (generation-simplified for Standard). The
              "prior similar" panel is SUPPLEMENTARY institutional context (§3.6) —
              a Standard agent doesn't need it up front, so collapse it behind a
              one-click reveal. Non-destructive: Expert sees it inline exactly as
              before; Standard sees it one click away, never removed. UNTESTED at
              runtime (0110 unapplied — needs founder live review of this surface). */}
          {priorSimilar.length > 0 && (
            <AdvancedDetail
              className="mt-3"
              label={`Show ${priorSimilar.length} related past case${
                priorSimilar.length > 1 ? "s" : ""
              }`}
            >
            <div className="mt-4 pt-3 border-t border-default">
              <p className="text-xs uppercase tracking-widest text-muted font-bold mb-2">
                We&apos;ve handled this kind of issue before
              </p>
              <ul className="space-y-1">
                {priorSimilar.map((p) => (
                  <li
                    key={p.id}
                    className="text-xs text-secondary leading-relaxed"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted mr-1.5">
                      {p.category ?? "uncat"}
                    </span>
                    {p.issueSummary.length > 90
                      ? p.issueSummary.slice(0, 87) + "…"
                      : p.issueSummary}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-muted italic mt-2">
                §3.6 — past resolutions the System matched against
                this conversation. Read them; they may shape the
                reply.
              </p>
            </div>
            </AdvancedDetail>
          )}
        </>
      )}
    </ToolPanelShell>
  );
}

/**
 * "Dissect a Conversation" (founder 2026-07-21) inside C.A.R.E — the same engine as the
 * standalone /dashboard/dissect page, run on THIS support thread. Where Summarize gives a
 * catch-up read, Dissect gives the problem-solving lens: the core problem, evidence quoted
 * from the thread, the root cause (§0), the outside view (§1.3), and angles to CONSIDER
 * (§3.3 — not prescriptions), ending on a guiding question so the AGENT renders the verdict
 * (§A11). Honest-empty when the thread is too thin to diagnose (§3.4) — never a fabricated
 * problem.
 */
function DissectCarePanel({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [dissect, setDissect] = useState<ConversationDissect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Ask-Coach follow-up (parity with the standalone Dissect, AMD-006 §1.5.1 — don't dead-end
  // the agent at the diagnosis; let them interrogate it). Ephemeral thread, echoed back each turn.
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const ask = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    const history = turns;
    setTurns((t) => [...t, { role: "user", text: q }]);
    setQuestion("");
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${conversationId}/dissect/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            problemStatement: dissect?.problem.statement ?? undefined,
            history,
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.reply) {
        setAskError(data?.error ?? "The coach couldn't respond. Try again.");
        setTurns((t) => t.filter((_, i) => i !== t.length - 1)); // roll back the optimistic user turn
        setQuestion(q);
        return;
      }
      setTurns((t) => [...t, { role: "coach", text: data.reply as string }]);
    } catch {
      setAskError("Couldn't reach the server.");
      setTurns((t) => t.filter((_, i) => i !== t.length - 1));
      setQuestion(q);
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/care/agent/conversations/${conversationId}/dissect`,
          { method: "POST" }
        );
        if (!res.ok) {
          setError("Couldn't dissect this conversation.");
          return;
        }
        const data = await res.json();
        setDissect((data.dissect as ConversationDissect) ?? null);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [conversationId]);

  const label = "text-xs uppercase tracking-widest text-muted font-bold mb-2";
  return (
    <ToolPanelShell title="Dissect" onClose={onClose}>
      {loading && (
        <p className="text-xs text-muted flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Dissecting the thread…
        </p>
      )}
      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}

      {/* Honest-empty (§3.4): too little to diagnose is NOT a fabricated problem. */}
      {dissect && !dissect.hasSignal && (
        <p className="text-sm text-secondary leading-relaxed">
          Not enough in this thread yet to dissect honestly — there&apos;s no clear problem to
          diagnose. As the conversation develops, run this again.
        </p>
      )}

      {dissect && dissect.hasSignal && (
        <div className="space-y-4">
          <div>
            <p className={label}>Summary</p>
            <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
              {dissect.summary}
            </p>
          </div>

          <div>
            <p className={label}>The problem</p>
            <p className="text-sm text-primary leading-relaxed">
              {dissect.problem.statement}
            </p>
            {dissect.problem.whyItMatters && (
              <p className="text-xs text-secondary leading-relaxed mt-1">
                Why it matters: {dissect.problem.whyItMatters}
              </p>
            )}
          </div>

          {dissect.evidence.length > 0 && (
            <div>
              <p className={label}>Evidence from the thread</p>
              <ul className="space-y-2">
                {dissect.evidence.map((e, i) => (
                  <li key={i} className="text-xs leading-relaxed">
                    <span className="text-secondary">{e.observation}</span>
                    {e.excerpt && (
                      <span className="block mt-0.5 pl-2 border-l-2 border-default text-muted italic">
                        “{e.excerpt}”
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dissect.rootCause && (
            <div>
              <p className={label}>Root cause</p>
              <p className="text-sm text-primary leading-relaxed">{dissect.rootCause}</p>
            </div>
          )}

          {dissect.outsideView && (
            <div>
              <p className={label}>Outside view</p>
              <p className="text-sm text-secondary leading-relaxed">{dissect.outsideView}</p>
            </div>
          )}

          {dissect.anglesToConsider.length > 0 && (
            <div>
              <p className={label}>Angles to consider</p>
              <ul className="space-y-2">
                {dissect.anglesToConsider.map((a, i) => (
                  <li key={i} className="text-xs leading-relaxed">
                    <span className="text-primary font-medium">{a.angle}</span>
                    {a.why && <span className="text-secondary"> — {a.why}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dissect.guidingQuestion && (
            <div className="pt-3 border-t border-default">
              <p className="text-sm text-brand leading-relaxed">
                {dissect.guidingQuestion}
              </p>
              <ExpertOnly>
                <p className="text-[10px] text-muted italic mt-2">
                  §3.3 — these are angles to consider, not a verdict. You decide the
                  reply; the System surfaces the diagnosis, not the answer.
                </p>
              </ExpertOnly>
            </div>
          )}

          {/* Ask-Coach follow-up — interrogate the diagnosis (parity with the standalone
              Dissect). §3.3: the coach asks what you think first, then builds on it. */}
          <div className="pt-3 border-t border-default">
            <p className={label}>Dig into it</p>
            {turns.length > 0 && (
              <div className="space-y-2 mb-2">
                {turns.map((t, i) => (
                  <div
                    key={i}
                    className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed whitespace-pre-wrap ${
                        t.role === "user"
                          ? "bg-arc-400/15 text-primary"
                          : "bg-surface border border-default text-primary"
                      }`}
                    >
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {asking && (
              <p className="text-[11px] text-muted flex items-center gap-2 mb-2">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                Thinking…
              </p>
            )}
            {askError && <p className="text-[11px] text-red-700 dark:text-red-300 mb-2">{askError}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                rows={1}
                placeholder="Ask about the problem, the root cause, an angle…"
                aria-label="Ask the coach about this diagnosis"
                disabled={asking}
                className="flex-1 min-w-0 bg-base border border-default rounded-lg px-2.5 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none max-h-24"
              />
              <button
                type="button"
                onClick={() => void ask()}
                disabled={asking || !question.trim()}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-brand border border-arc-400/40 hover:border-arc-400/70 disabled:opacity-40 px-2.5 py-1.5 rounded-md"
              >
                <Send className="w-3.5 h-3.5" aria-hidden />
                Ask
              </button>
            </div>
          </div>
        </div>
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
      if (data.suppressed) {
        // §3.4 control window — agent drafts solo. Honest
        // surface beats silent failure per TT.md A21.
        setError(
          data.message ??
            "Formulate is in control window — draft solo for now."
        );
        return;
      }
      setResult({ draft: data.draft, reasoning: data.reasoning });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <ToolPanelShell title="Formulate C.A.R.E" onClose={onClose}>
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
          {error && <p className="text-xs text-red-700 dark:text-red-300 mt-2">{error}</p>}
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!intent.trim() || drafting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] px-3 py-1.5 rounded-md"
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 text-[#09090B] px-3 py-1.5 rounded-md"
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
 * current draft. Per TT.md A21 (2026-06-18) — same Coach v5
 * backend + same v5 UI as ELOSTATE's chat-side Ask Coach.
 * Cross-system feature parity: founder framing — "asked coach
 * is one of the biggest features a customer management chat
 * system can have."
 *
 * Backend: /api/care/agent/conversations/[id]/ask-coach now
 * returns CoachAnalysisResponse (the same shape /api/coach/v5/
 * analyze returns). The follow-up endpoint at .../followup
 * handles conversational depth.
 *
 * UI mirrors CoachPanelV5 (chats):
 *   - HERE'S WHAT I'M SEEING — improvement.whyContext
 *   - WANT TO TRY THIS? — improvement.suggestedRevision with
 *     source citation (principle name + book)
 *   - Use this revision / Send as written CTAs
 *   - YOU COULD ASK ME — conversationStarters chips
 *   - Ask me anything about this draft… — free-form input
 *   - Turn bubbles for the multi-turn conversation
 */
function AskCoachCarePanel({
  conversationId,
  draft,
  onAcceptRevision,
  onClose,
}: {
  conversationId: string;
  draft: string;
  onAcceptRevision: (revision: string) => void;
  onClose: () => void;
}) {
  type Principle = { name: string; book: string; sectionRef: string };
  type Improvement = {
    suggestedRevision: string;
    whyContext: string;
    whySentence: string;
    principleCited: Principle;
    secondaryPrinciple?: Principle;
  };
  type CoachResponse = {
    classification: string;
    needsImprovement: boolean;
    affirmation?: string;
    improvement?: Improvement;
    conversationStarters: string[];
  };
  type Turn =
    | { role: "user"; content: string }
    | { role: "coach"; content: string; alternativeRevision?: string };

  const [response, setResponse] = useState<CoachResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [followUpInput, setFollowUpInput] = useState("");
  const [followingUp, setFollowingUp] = useState(false);
  const [starters, setStarters] = useState<string[]>([]);
  const [needsDraft, setNeedsDraft] = useState(false);

  useEffect(() => {
    setResponse(null);
    setError(null);
    setNeedsDraft(false);
    setTurns([]);
    setStarters([]);
    // Coach grades the reply DRAFT, so it needs one. If the composer is empty, DON'T call the route
    // (it requires a draft and would just error) — show a friendly "type your reply first" prompt.
    // The panel is a right-side drawer, so the composer stays visible on the left; this effect depends
    // on `draft`, so once the agent starts typing, it re-runs and grades automatically.
    if (!draft.trim()) {
      setNeedsDraft(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Debounce: grade only after typing settles, so editing the draft in the composer (the drawer
    // leaves it visible) doesn't fire an LLM grading call on every keystroke — Coach v5 is expensive.
    // Grades ~650ms after the last change.
    const debounce = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/care/agent/conversations/${conversationId}/ask-coach`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draft, mode: "ask" }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? `Coach unavailable (HTTP ${res.status})`);
          return;
        }
        const data = await res.json();
        if (data.suppressed) {
          setError("Coach is in control window — guidance suppressed.");
          return;
        }
        if (!data.response) {
          setError("Coach returned an empty response.");
          return;
        }
        setResponse(data.response as CoachResponse);
        setStarters(data.response.conversationStarters ?? []);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
      })();
    }, 650);
    return () => clearTimeout(debounce);
  }, [conversationId, draft]);

  async function askFollowUp(question: string) {
    if (!question.trim() || followingUp) return;
    const trimmed = question.trim();
    setTurns((t) => [...t, { role: "user", content: trimmed }]);
    setFollowUpInput("");
    setFollowingUp(true);
    try {
      const priorTurns = [...turns, { role: "user" as const, content: trimmed }];
      const res = await fetch(
        `/api/care/agent/conversations/${conversationId}/ask-coach/followup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft,
            priorTurns: priorTurns.map((t) => ({
              role: t.role,
              content: t.content,
            })),
            userQuestion: trimmed,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setTurns((t) => [
          ...t,
          {
            role: "coach",
            content: body?.error ?? "Coach couldn't respond just now.",
          },
        ]);
        return;
      }
      const data = await res.json();
      if (data.suppressed || !data.response) {
        setTurns((t) => [
          ...t,
          { role: "coach", content: "Coach is unavailable right now." },
        ]);
        return;
      }
      const reply = data.response as {
        reply: string;
        alternativeRevision?: string;
        conversationStarters: string[];
      };
      setTurns((t) => [
        ...t,
        {
          role: "coach",
          content: reply.reply,
          alternativeRevision: reply.alternativeRevision,
        },
      ]);
      setStarters(reply.conversationStarters ?? []);
    } catch {
      setTurns((t) => [
        ...t,
        { role: "coach", content: "Couldn't reach the server." },
      ]);
    } finally {
      setFollowingUp(false);
    }
  }

  return (
    <ToolPanelShell title="Ask Coach" onClose={onClose}>
      {loading && (
        <p className="text-xs text-muted flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Reading your draft…
        </p>
      )}
      {needsDraft && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Type your reply first</p>
          <p className="text-xs text-muted leading-relaxed">
            Coach grades the reply you&apos;re about to send — so it needs a draft. Start typing your
            reply in the composer and Coach will grade it here automatically.
          </p>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="text-xs text-red-700 dark:text-red-300 border border-red-500/30 bg-red-500/5 rounded-md px-2.5 py-2"
        >
          {error}
        </div>
      )}
      {response && (
        <div className="space-y-3">
          {response.affirmation && (
            <div className="flex items-start gap-2">
              <Sparkles
                className="w-3 h-3 text-emerald-700 dark:text-emerald-400 mt-0.5 flex-shrink-0"
                aria-hidden
              />
              <p className="text-xs text-primary leading-relaxed">
                {response.affirmation}
              </p>
            </div>
          )}

          {response.improvement && (
            <>
              <div className="rounded-lg bg-amber-400/10 border border-amber-400/30 p-2.5 space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-mono text-brand">
                  Here&apos;s what I&apos;m seeing
                </p>
                <p className="text-xs text-primary leading-relaxed">
                  {response.improvement.whyContext}
                </p>
              </div>

              <div className="rounded-lg bg-surface border border-default p-2.5 space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-mono text-brand">
                  Want to try this?
                </p>
                <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
                  {response.improvement.suggestedRevision}
                </p>
                <p className="text-[11px] text-secondary leading-relaxed border-l-2 border-amber-400/40 pl-2 italic">
                  {response.improvement.whySentence}
                </p>
                <p className="text-[10px] text-muted font-mono uppercase tracking-wider">
                  {response.improvement.principleCited.name}
                  {" — "}
                  {response.improvement.principleCited.book}
                  {response.improvement.secondaryPrinciple && (
                    <>
                      {" + "}
                      {response.improvement.secondaryPrinciple.name}
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    response.improvement &&
                    onAcceptRevision(response.improvement.suggestedRevision)
                  }
                  className="text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 px-2.5 py-1 rounded-md transition-colors"
                >
                  Use this revision
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[11px] text-muted hover:text-secondary"
                >
                  Send as written
                </button>
              </div>
            </>
          )}

          {turns.length > 0 && (
            <div className="pt-2 border-t border-amber-400/15 space-y-2">
              {turns.map((turn, i) => (
                <div key={i} className="text-xs leading-relaxed">
                  {turn.role === "user" ? (
                    <p className="text-secondary">
                      <span className="text-muted font-mono text-[10px] uppercase tracking-widest mr-1.5">
                        You
                      </span>
                      {turn.content}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-primary">
                        <span className="text-brand font-mono text-[10px] uppercase tracking-widest mr-1.5">
                          Coach
                        </span>
                        {turn.content}
                      </p>
                      {turn.alternativeRevision && (
                        <div className="rounded-md bg-surface border border-default p-2 space-y-1.5">
                          <p className="text-sm text-primary whitespace-pre-wrap">
                            {turn.alternativeRevision}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              turn.alternativeRevision &&
                              onAcceptRevision(turn.alternativeRevision)
                            }
                            className="text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 px-2 py-0.5 rounded"
                          >
                            Use this revision
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {followingUp && (
                <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-widest font-mono">
                  <Loader2
                    className="w-3 h-3 text-brand/60 animate-spin"
                    aria-hidden
                  />
                  Coach is thinking…
                </div>
              )}
            </div>
          )}

          {starters.length > 0 && !followingUp && (
            <div className="pt-2 border-t border-amber-400/15 space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest font-mono text-muted">
                You could ask me
              </p>
              <div className="flex flex-wrap gap-1.5">
                {starters.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => askFollowUp(s)}
                    className="text-[11px] text-primary border border-default hover:border-strong bg-surface hover:bg-surface-raised rounded-full px-2 py-0.5 text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="pt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void askFollowUp(followUpInput);
            }}
          >
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              placeholder="Ask me anything about this draft…"
              disabled={followingUp}
              className="flex-1 min-w-0 bg-base border border-default focus:border-strong rounded-md px-2.5 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none"
            />
            <button
              type="submit"
              disabled={followingUp || !followUpInput.trim()}
              aria-label="Send"
              className="shrink-0 inline-flex items-center justify-center bg-amber-400/10 hover:bg-amber-400/20 disabled:opacity-40 text-brand border border-amber-400/30 rounded-md w-7 h-7"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
            </button>
          </form>
        </div>
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
        // h-dvh so iOS keyboard doesn't bleed the drawer past the
        // viewport. overflow-hidden keeps the sticky header glued
        // to the top of THIS drawer rather than the document.
        className="w-full max-w-md bg-base border-l border-default h-dvh flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: safe-area top so the title + close button push
            BELOW the iOS status bar / Dynamic Island on phones with
            a notch. Without this on /dashboard/care which renders
            full-bleed, the system clock + battery sat directly on
            top of "Ask Coach" and the X — both untappable. */}
        <div
          className="px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-default flex items-center justify-between bg-base flex-shrink-0"
        >
          <h2 className="text-sm font-semibold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-primary p-1.5 rounded hover:bg-surface-raised"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
