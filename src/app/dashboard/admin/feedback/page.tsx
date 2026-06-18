"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Filter,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  ThumbsUp,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import { MentionText } from "@/components/ui/MentionText";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import type { CoachContextPayload } from "@/lib/coach/v5/types";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";

/**
 * /dashboard/admin/feedback
 *
 * Triage inbox for the admin role. Lists every feedback report for
 * the company; each transition through status (open → triaged →
 * in_progress → resolved / declined / duplicate) emits a separate
 * `feedback.status_changed` event into the §3.1 chain, so the
 * journey is on the record.
 *
 * Per §3.6 "make-learning-visible," users who submitted feedback can
 * see the journey of their report — admins use this surface to drive
 * those transitions.
 */

type FeedbackKind =
  | "bug"
  | "idea"
  | "question"
  | "friction"
  | "praise"
  | "smoke_test_result";

type FeedbackStatus =
  | "open"
  | "triaged"
  | "in_progress"
  | "resolved"
  | "declined"
  | "duplicate";

type FeedbackRow = {
  id: string;
  kind: FeedbackKind;
  title: string;
  body: string;
  page_path: string;
  payload: Record<string, unknown>;
  status: FeedbackStatus;
  author_id: string | null;
  parent_id: string | null;
  triaged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  duplicate_of: string | null;
  created_at: string;
};

const KIND_ICONS: Record<
  FeedbackKind,
  React.ComponentType<{ className?: string }>
> = {
  bug: Bug,
  idea: Lightbulb,
  question: HelpCircle,
  friction: AlertTriangle,
  praise: ThumbsUp,
  smoke_test_result: CheckCircle2,
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: "border-default bg-surface text-secondary",
  triaged: "border-arc-400/40 bg-arc-400/10 text-arc-300",
  in_progress: "border-ember-400/40 bg-ember-400/10 text-brand",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  declined: "border-default bg-surface-raised text-muted",
  duplicate: "border-default bg-surface-raised text-muted",
};

export default function AdminFeedbackPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "open"
  );
  const [kindFilter, setKindFilter] = useState<FeedbackKind | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (kindFilter !== "all") params.set("kind", kindFilter);
      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (!res.ok) {
        toast.error("Couldn't load feedback");
        return;
      }
      const data = (await res.json()) as { feedback: FeedbackRow[] };
      setRows(data.feedback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, kindFilter]);

  const counts = useMemo(() => {
    const c: Record<FeedbackStatus, number> = {
      open: 0,
      triaged: 0,
      in_progress: 0,
      resolved: 0,
      declined: 0,
      duplicate: 0,
    };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const transition = async (
    id: string,
    next: FeedbackStatus,
    resolution_note?: string
  ) => {
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, resolution_note }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error("Triage failed", data.error ?? `HTTP ${res.status}`);
      return;
    }
    toast.success(`Marked ${next.replace("_", " ")}`);
    void load();
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Feedback inbox"
        subtitle="Triage tester reports — every transition lands on the §3.1 chain"
      />
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-3.5 h-3.5 text-brand" aria-hidden />
            <p className="text-xs uppercase tracking-widest text-muted">
              Filter
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {(
              ["all", "open", "triaged", "in_progress", "resolved", "declined", "duplicate"] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  statusFilter === s
                    ? "border-brand bg-ember-400/8 text-brand"
                    : "border-default text-muted hover:text-primary"
                }`}
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              ["all", "bug", "friction", "idea", "question", "praise", "smoke_test_result"] as const
            ).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                  kindFilter === k
                    ? "border-brand bg-ember-400/8 text-brand"
                    : "border-default text-muted hover:text-primary"
                }`}
              >
                {k === "all" ? "All kinds" : k.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {(
            ["open", "triaged", "in_progress", "resolved", "declined", "duplicate"] as const
          ).map((s) => (
            <div
              key={s}
              className={`glass-card p-3 ${s === statusFilter ? "border-brand" : ""}`}
            >
              <p className="text-[10px] uppercase tracking-widest text-muted">
                {s.replace("_", " ")}
              </p>
              <p className="text-lg font-bold text-primary">{counts[s]}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <MessageSquarePlus
              className="w-6 h-6 text-muted mx-auto mb-2"
              aria-hidden
            />
            <p className="text-sm text-primary mb-1">No feedback matching your filter.</p>
            <p className="text-xs text-muted">
              Either nothing has been reported yet, or your filter is too narrow.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <FeedbackRowCard
                key={row.id}
                row={row}
                expanded={expanded === row.id}
                onToggle={() =>
                  setExpanded((curr) => (curr === row.id ? null : row.id))
                }
                onTransition={transition}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackRowCard({
  row,
  expanded,
  onToggle,
  onTransition,
}: {
  row: FeedbackRow;
  expanded: boolean;
  onToggle: () => void;
  onTransition: (
    id: string,
    next: FeedbackStatus,
    resolution_note?: string
  ) => void | Promise<void>;
}) {
  const [note, setNote] = useState(row.resolution_note ?? "");
  // Coach v5 — the admin is writing a resolution note. The
  // feedbackKind tells the Coach what kind of feedback is being
  // resolved (bug / idea / friction / praise) so the right
  // Knowledge Base layer is applied.
  const [askCoachToken, setAskCoachToken] = useState(0);
  const coachV5Payload = useMemo<CoachContextPayload>(
    () => ({ feedbackKind: row.kind }),
    [row.kind]
  );
  const Icon = KIND_ICONS[row.kind];
  const screenshot = row.payload["screenshot_data_url"] as string | undefined;
  const { enabled: coachEnabled } = useCoachEnabled();

  return (
    <div className="glass-card p-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3"
      >
        <Icon className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-primary truncate flex-1">
              {row.title}
            </p>
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${STATUS_COLORS[row.status]}`}
            >
              {row.status.replace("_", " ")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted font-mono">
            <span>{row.kind}</span>
            <span>·</span>
            <span>{row.page_path}</span>
            {/* Per TT.md A21 audit MED fix — surface the source
                context so smoke-test-spawned feedback can be
                triaged differently than floating-button feedback
                (different urgency, different §1.6 close-the-loop
                relationship). */}
            {row.payload["source_context"] === "smoke_test" && (
              <>
                <span>·</span>
                <span className="text-ember-400">smoke test</span>
              </>
            )}
            <span>·</span>
            <span>{new Date(row.created_at).toLocaleString()}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-default space-y-3">
          {row.body && (
            <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
              <MentionText text={row.body} />
            </p>
          )}

          {screenshot && (
            <div className="rounded-lg border border-default overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot} alt="Screenshot" className="w-full h-auto" />
            </div>
          )}

          {/* Triage actions */}
          <div>
            {coachEnabled && (
              <>
                <CoachPanelV5
                  draft={note}
                  contextType="feedback"
                  contextPayload={coachV5Payload}
                  askCoachToken={askCoachToken}
                  onAcceptRevision={(revised) => setNote(revised)}
                />
                <div className="mb-2 flex justify-end">
                  <AskCoachButton
                    disabled={!note.trim()}
                    onAsk={() => setAskCoachToken((t) => t + 1)}
                  />
                </div>
              </>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Resolution / decline note (saved with the transition event)"
              className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 resize-none mb-2"
            />
            <div className="flex flex-wrap items-center gap-2">
              {(["triaged", "in_progress", "resolved", "declined"] as FeedbackStatus[]).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={row.status === s}
                    onClick={() => void onTransition(row.id, s, note)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-default hover:border-strong text-secondary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Mark {s.replace("_", " ")}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
