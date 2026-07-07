"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  CornerDownLeft,
  DollarSign,
  GitMerge,
  Stethoscope,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquare,
  Mic,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Command palette. Bound to Cmd+K (mac) and Ctrl+K (everywhere else).
 *
 * Two affordances:
 *  1. Navigate — jump to any production or design-preview surface
 *  2. Run quick action — e.g. "New task", "New problem", "Run learning cycle"
 *
 * Keyboard:
 *  - Cmd/Ctrl+K toggles
 *  - ESC closes
 *  - Up/Down navigate the list
 *  - Enter runs the highlighted action
 *
 * The palette mounts once at the layout level; opening/closing is local state.
 * Honors Rule 1.7 a11y polish: role="dialog", aria-modal, the listbox carries
 * role="listbox" with aria-activedescendant pointing at the highlighted item.
 */

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Either navigate to a route OR run a side effect. */
  href?: string;
  run?: () => void;
  group: "Navigate" | "Create" | "System";
  keywords?: string[];
};

const NAV_ACTIONS: Omit<Action, "run">[] = [
  { id: "nav-dashboard", label: "Command Center", icon: LayoutDashboard, href: "/dashboard", group: "Navigate", keywords: ["home", "dashboard"] },
  { id: "nav-chats", label: "Team Chat", icon: MessageSquare, href: "/dashboard/chats", group: "Navigate", keywords: ["chat", "topic", "conversation", "slack"] },
  { id: "nav-tasks", label: "Tasks", icon: ListChecks, href: "/dashboard/operations", group: "Navigate", keywords: ["work", "todo", "operations"] },
  { id: "nav-team", label: "Team", icon: Users, href: "/dashboard/team", group: "Navigate", keywords: ["members", "people", "invite"] },
  { id: "nav-diagnose", label: "Living Diagnosis", icon: GitMerge, href: "/dashboard/diagnose", group: "Navigate", keywords: ["loop", "engine", "constitution"] },
  { id: "nav-dissect", label: "Dissect a Conversation", icon: Stethoscope, href: "/dashboard/dissect", group: "Navigate", keywords: ["paste", "diagnose", "problem", "ask coach", "summarize", "transcript"] },
  { id: "nav-problems", label: "Problems", icon: ShieldCheck, href: "/dashboard/problems", group: "Navigate", keywords: ["gate", "hypothesis"] },
  { id: "nav-resolutions", label: "Resolutions", icon: Sparkles, href: "/dashboard/resolutions", group: "Navigate", keywords: ["outcomes", "held"] },
  { id: "nav-brain", label: "Company Brain", icon: Brain, href: "/dashboard/brain", group: "Navigate", keywords: ["learning", "memory"] },
  { id: "nav-decisions", label: "Decision Dialogue", icon: Brain, href: "/dashboard/decisions", group: "Navigate", keywords: ["decide", "dialogue"] },
  { id: "nav-bootcamp", label: "Bootcamp", icon: GraduationCap, href: "/dashboard/bootcamp", group: "Navigate", keywords: ["training", "learning", "course", "teach"] },
  { id: "nav-bootcamp-sales", label: "Master Sales Mind", icon: GraduationCap, href: "/dashboard/bootcamp/master-sales-mind", group: "Navigate", keywords: ["sales", "selling", "training", "bootcamp"] },
  { id: "nav-sales-coach", label: "Live Sales Coach", icon: Mic, href: "/dashboard/sales-coach", group: "Navigate", keywords: ["sales", "coach", "live", "call", "review", "growth", "cue"] },
  { id: "nav-finance", label: "Finance (design preview)", icon: DollarSign, href: "/dashboard/finance", group: "Navigate", keywords: ["money", "runway", "burn"] },
  { id: "nav-marketing", label: "Marketing (design preview)", icon: Megaphone, href: "/dashboard/marketing", group: "Navigate", keywords: ["growth", "leads"] },
  { id: "nav-settings", label: "Settings", icon: Settings, href: "/dashboard/settings", group: "System", keywords: ["config", "provider", "company"] },
];

// Per-section teaching copy for Learning Mode. Keyed by the group label
// so each section header carries a hint tailored to what that group does,
// rather than one generic note on every result row.
const GROUP_HINTS: Record<
  Action["group"],
  { title: string; whatItIs: string; why: string; how: string; principle: string }
> = {
  Navigate: {
    title: "Navigate",
    whatItIs:
      "Jump straight to any surface in the product — dashboards, the diagnosis loop, chats, tasks, and the design previews — without clicking through menus.",
    why: "As the product grows, hunting for a page through nested navigation gets slower every month. A keyboard-first jump keeps every surface one search away, so depth never costs you reach.",
    how: "Type part of a destination's name or a related keyword, use ↑↓ to highlight, and press ↵ to go.",
    principle: "Keep every surface one search away — reach shouldn't degrade as depth grows.",
  },
  Create: {
    title: "Create",
    whatItIs:
      "Kick off a new thing — a chat topic, a task, a problem hypothesis, a team invite, a decision dialogue — from wherever you are.",
    why: "The moment you decide to capture something is the moment it's most likely to be lost to friction. Starting it from the palette means an intent becomes an artifact before it evaporates.",
    how: "Pick a create action and press ↵; it routes you to the right page with its create flow already open.",
    principle: "Capture the intent the instant it forms, before friction erases it.",
  },
  System: {
    title: "System",
    whatItIs:
      "Reach system-level surfaces like Settings — provider keys, company config, and the controls that govern the whole workspace.",
    why: "Configuration and everyday work are different modes of thinking; keeping system actions in their own group means you don't stumble into workspace-wide settings while looking for a task.",
    how: "Search here for configuration surfaces, then ↵ to open them.",
    principle: "Separate the controls that change everything from the ones you use every day.",
  },
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Quick-action defs that close the palette and route + emit a "create" intent.
  // The destination page reads `?new=1` and opens its own create modal.
  const createActions: Action[] = useMemo(
    () => [
      {
        id: "create-chat",
        label: "New team chat topic",
        hint: "Start a topic-based conversation that captures structured outcomes.",
        icon: MessageSquare,
        href: "/dashboard/chats?new=1",
        group: "Create",
        keywords: ["chat", "topic", "conversation"],
      },
      {
        id: "create-task",
        label: "New task",
        hint: "Create a new task — emits a task.created event into the chain.",
        icon: ListChecks,
        href: "/dashboard/operations?new=1",
        group: "Create",
        keywords: ["add task", "create"],
      },
      {
        id: "create-problem",
        label: "New problem hypothesis",
        hint: "Start a draft problem you'll back with signals.",
        icon: ShieldCheck,
        href: "/dashboard/problems?new=1",
        group: "Create",
        keywords: ["hypothesis", "problem"],
      },
      {
        id: "create-invite",
        label: "Invite team member",
        hint: "Generate an invite link.",
        icon: Users,
        href: "/dashboard/team?new=1",
        group: "Create",
        keywords: ["invite", "team", "add member"],
      },
      {
        id: "create-decision",
        label: "Start decision dialogue",
        hint: "Walk a decision with the System.",
        icon: Brain,
        href: "/dashboard/decisions",
        group: "Create",
        keywords: ["decide", "decision"],
      },
    ],
    []
  );

  const actions: Action[] = useMemo(
    () => [...NAV_ACTIONS, ...createActions],
    [createActions]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => {
      const haystack = [
        a.label,
        a.hint,
        a.group,
        ...(a.keywords ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [actions, query]);

  // Group filtered for rendering.
  const grouped = useMemo(() => {
    const order: Action["group"][] = ["Navigate", "Create", "System"];
    const out: Record<string, Action[]> = {};
    for (const g of order) out[g] = [];
    for (const a of filtered) out[a.group]!.push(a);
    return order
      .map((g) => ({ group: g, items: out[g]! }))
      .filter((x) => x.items.length > 0);
  }, [filtered]);

  // Reset highlight when filter changes.
  useEffect(() => {
    setActive(0);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const runAction = useCallback(
    (a: Action) => {
      if (a.href) router.push(a.href);
      a.run?.();
      close();
    },
    [router, close]
  );

  // Global Cmd/Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isToggle) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Open lifecycle (focus + body scroll) — runs only on `open` change
  // to avoid re-focusing on every keystroke. Same fix shape as Modal.
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Keydown listener — re-bound when filtered/active/close/runAction
  // change so the latest closure is used. No focus or body-scroll
  // side effects here; those belong to the open-lifecycle effect.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(filtered.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        const target = filtered[active];
        if (target) {
          e.preventDefault();
          runAction(target);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, filtered, active, close, runAction]);

  // Scroll active row into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-cmd-index="${active}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  if (!open) return null;

  // Compute the flat index of each item so the active row can be uniquely identified.
  let flat = 0;

  return (
    <div
      // pt-[15vh] reserves top space on desktop; on mobile we
      // start higher (pt-[5vh]) so the palette has room to render
      // its results panel within the visible viewport.
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[5vh] md:pt-[15vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl bg-surface border border-default rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-default">
          <Search className="w-4 h-4 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search · Esc to close"
            aria-label="Command palette search"
            aria-controls="cmd-list"
            aria-activedescendant={
              filtered[active] ? `cmd-row-${filtered[active].id}` : undefined
            }
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted focus:outline-none"
          />
          <kbd className="text-[10px] text-muted bg-base border border-default rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="cmd-list"
          role="listbox"
          className="max-h-[60dvh] md:max-h-[50vh] overflow-y-auto py-2"
        >
          {grouped.length === 0 && (
            <p className="text-center text-xs text-muted py-6">
              No matches.
            </p>
          )}
          {grouped.map(({ group, items }) => (
            <div key={group} className="mb-2 last:mb-0">
              <LearningHint
                as="block"
                category="Command Palette · Section"
                title={GROUP_HINTS[group].title}
                whatItIs={GROUP_HINTS[group].whatItIs}
                why={GROUP_HINTS[group].why}
                how={GROUP_HINTS[group].how}
                principle={GROUP_HINTS[group].principle}
              >
                <p className="px-4 py-1 text-[10px] uppercase tracking-widest text-muted">
                  {group}
                </p>
              </LearningHint>
              {items.map((a) => {
                const Icon = a.icon;
                const idx = flat++;
                const isActive = idx === active;
                return (
                  <div
                    key={a.id}
                    id={`cmd-row-${a.id}`}
                    data-cmd-index={idx}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runAction(a)}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
                      isActive ? "bg-ember-400/15" : "hover:bg-surface-raised"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? "text-brand" : "text-muted"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${
                          isActive ? "text-white" : "text-primary"
                        }`}
                      >
                        {a.label}
                      </p>
                      {a.hint && (
                        <p className="text-[10px] text-muted truncate">
                          {a.hint}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <CornerDownLeft
                        className="w-3.5 h-3.5 text-brand"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-default text-[10px] text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="bg-base border border-default rounded px-1 py-0.5 font-mono">
                ↑↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="bg-base border border-default rounded px-1 py-0.5 font-mono">
                ↵
              </kbd>{" "}
              run
            </span>
          </div>
          <span>
            <kbd className="bg-base border border-default rounded px-1 py-0.5 font-mono">
              ⌘K
            </kbd>{" "}
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
