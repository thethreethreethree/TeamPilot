"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeedbackPanel } from "@/components/feedback/FeedbackPanel";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  ThumbsUp,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import { MentionText } from "@/components/ui/MentionText";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * /dashboard/feedback — tester-facing "My feedback" view.
 *
 * Why this exists: the admin inbox at /dashboard/admin/feedback is
 * gated to admin/CEO/COO. Testers who file reports need somewhere to
 * see them too — both so they can verify the report was received and
 * to watch the §3.6 "make-learning-visible" journey of the report:
 * open → triaged → in progress → resolved. Without this surface, the
 * report disappears from the tester's view the moment they submit,
 * which feels like the chain "ate" their input.
 *
 * This page calls /api/feedback?mine=1 — the server uses the row's
 * author_id matched to the authenticated user, so RLS guarantees a
 * tester only ever sees their own reports here.
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

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  triaged: "Triaged",
  in_progress: "In progress",
  resolved: "Resolved",
  declined: "Declined",
  duplicate: "Duplicate",
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: "border-default bg-surface text-secondary",
  triaged: "border-arc-400/40 bg-arc-400/10 text-arc-300",
  in_progress: "border-ember-400/40 bg-ember-400/10 text-brand",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  declined: "border-default bg-surface-raised text-muted",
  duplicate: "border-default bg-surface-raised text-muted",
};

// Suspense boundary so useSearchParams() can never fail static prerendering (the /login-class build break
// that errored every Vercel deploy for weeks — 2026-07-21). This page is dynamic today, so this is defensive:
// if it ever gets statically optimized, the build still passes.
export default function MyFeedbackPage() {
  return (
    <Suspense fallback={null}>
      <MyFeedbackPageInner />
    </Suspense>
  );
}

function MyFeedbackPageInner() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Compose panel state — opens immediately when the page is
  // entered via ?intent=feedback (from the landing-page Feedback
  // link routing through /login), or when the user explicitly
  // clicks "Submit new feedback" below.
  const searchParams = useSearchParams();
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (searchParams?.get("intent") === "feedback") {
      setComposing(true);
    }
  }, [searchParams]);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "all"
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ mine: "1" });
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/feedback?${params.toString()}`);
        if (!res.ok) {
          toast.error("Couldn't load your feedback");
          return;
        }
        const data = (await res.json()) as { feedback: FeedbackRow[] };
        setRows(data.feedback);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

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

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="My feedback"
        subtitle="The journey of every report you've filed — open, triaged, resolved"
      />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        {/* Composer entry — replaces the misleading "use the
            floating button" copy. Floating button is suppressed on
            dashboard routes; this page IS the submission entry. */}
        <LearningHint
          as="block"
          category="Feedback · My feedback"
          title="Submit new feedback"
          whatItIs="The entry point for filing a report — a bug, an idea, a question, a friction, or praise — from wherever you are in the product."
          why="Every report you file lands on the §3.1 chain as a permanent, append-only event. Nothing you say here is discarded; a dead end or a complaint is an asset equal to a success, because retrospective diagnosis reuses all of it."
          how="Click it whenever something surprises you — good or bad. Capture it while it's fresh; the report carries the page you were on, so you don't have to reconstruct context later."
          principle="Data-as-asset: no input is noise. Every report is permanent material for a future diagnosis."
        >
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden />
            Submit new feedback
          </button>
        </div>
        </LearningHint>
        {/* Why this page exists, in one line — answers the user's
            silent question "did my submission go anywhere?" */}
        <LearningHint
          as="block"
          category="Feedback · My feedback"
          title="Where your report goes"
          whatItIs="A one-line explanation of the path a report takes: filed here, triaged by admins, and every state change reflected back to you."
          why="Without this surface a report vanishes from your view the moment you submit — which feels like the chain ate your input. Seeing it move is the §3.6 make-learning-visible discipline: a system that acts on you invisibly is indistinguishable from one that ignored you."
          how="Read it as the promise the loop makes to you. When you file, come back here to watch the status advance rather than wondering whether anyone saw it."
          principle="Close the loop visibly — a report you can't track reads as a report that was ignored."
        >
        <div className="glass-card p-4 border border-ember-400/30 bg-ember-400/5">
          <p className="text-xs text-secondary leading-relaxed">
            Each report you file lands on the §3.1 chain as a permanent
            event. Admins triage from{" "}
            <code className="text-brand font-mono">
              /dashboard/admin/feedback
            </code>{" "}
            — every transition (triaged, in progress, resolved) shows up
            here so you can see your report actually moved.
          </p>
        </div>
        </LearningHint>

        {/* Status filter */}
        <LearningHint
          as="block"
          category="Feedback · My feedback"
          title="Status filter"
          whatItIs="Buttons that narrow your reports to a single stage — open, triaged, in progress, resolved, declined, or duplicate — with a live count beside each."
          why="The status set is the honest journey of a report, not a verdict on it. 'Declined' and 'duplicate' are legitimate outcomes with reasons attached, not failures — surfacing them keeps the loop truthful instead of hiding what didn't get built."
          how="Filter to 'in progress' to see what's actively moving, or 'resolved' to confirm what landed. The counts tell you where your reports are clustered at a glance."
          principle="Show every outcome, including the no's — an honest status set is worth more than a flattering one."
        >
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              "all",
              "open",
              "triaged",
              "in_progress",
              "resolved",
              "declined",
              "duplicate",
            ] as const
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
              {s === "all" ? "All" : STATUS_LABELS[s]}
              {s !== "all" && (
                <span className="ml-1 opacity-70">({counts[s]})</span>
              )}
            </button>
          ))}
        </div>
        </LearningHint>

        {/* Rows */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <MessageSquarePlus
              className="w-7 h-7 text-muted mx-auto mb-3"
              aria-hidden
            />
            <p className="text-sm text-primary mb-1">
              You haven&apos;t filed any feedback yet.
            </p>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed mb-3">
              Click <span className="text-primary font-medium">Submit new
              feedback</span> above to file a report. It&apos;ll appear
              here, and every triage transition admins make will show
              up too.
            </p>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-3 py-1.5 rounded-md text-xs transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden />
              Submit new feedback
            </button>
          </div>
        ) : (
          <LearningHint
            as="block"
            category="Feedback · My feedback"
            title="Your reports"
            whatItIs="The list of reports you've filed. Each row expands to show the body, any screenshot, an admin resolution note, and a journey timeline of timestamps."
            why="The journey timeline — filed, triaged, resolved — is the proof the report wasn't ignored (§3.6). Even three timestamps make the chain's work visible. RLS guarantees you only ever see your own rows here."
            how="Tap a row to expand it. Watch the journey ladder fill in over time; if it's still 'waiting for an admin to triage', the report is on the chain but hasn't moved yet."
            principle="A record you can watch move is a record you can trust — the timeline is the loop closing in view."
          >
          <div className="space-y-2">
            {rows.map((row) => (
              <MyFeedbackRow
                key={row.id}
                row={row}
                expanded={expanded === row.id}
                onToggle={() =>
                  setExpanded((curr) => (curr === row.id ? null : row.id))
                }
              />
            ))}
          </div>
          </LearningHint>
        )}
      </div>
      {composing && (
        <FeedbackPanel
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}

function MyFeedbackRow({
  row,
  expanded,
  onToggle,
}: {
  row: FeedbackRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = KIND_ICONS[row.kind];
  const screenshot = row.payload["screenshot_data_url"] as string | undefined;
  const annotations = row.payload["screenshot_annotations"] as
    | number
    | undefined;

  return (
    <div className="glass-card p-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3"
      >
        {expanded ? (
          <ChevronDown
            className="w-3.5 h-3.5 text-muted mt-1 flex-shrink-0"
            aria-hidden
          />
        ) : (
          <ChevronRight
            className="w-3.5 h-3.5 text-muted mt-1 flex-shrink-0"
            aria-hidden
          />
        )}
        <Icon className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-primary truncate flex-1">
              {row.title}
            </p>
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${STATUS_COLORS[row.status]}`}
            >
              {STATUS_LABELS[row.status]}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted font-mono">
            <span>{row.kind.replace("_", " ")}</span>
            <span>·</span>
            <span className="truncate">{row.page_path}</span>
            <span>·</span>
            <span>{new Date(row.created_at).toLocaleString()}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-default space-y-3">
          {row.body && (
            <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap break-words">
              <MentionText text={row.body} />
            </p>
          )}
          {screenshot && (
            <div className="space-y-1.5">
              <div className="rounded-lg border border-default overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot}
                  alt="Screenshot"
                  className="w-full h-auto"
                />
              </div>
              {annotations ? (
                <p className="text-[10px] text-muted font-mono">
                  {annotations} annotation{annotations === 1 ? "" : "s"} baked
                  into the screenshot
                </p>
              ) : null}
            </div>
          )}
          {row.resolution_note && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-1 font-bold">
                Admin note
              </p>
              <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
                <MentionText text={row.resolution_note} />
              </p>
            </div>
          )}

          {/* Journey timeline — surfaces the §3.6 "the chain knows"
              moment: even just three timestamps (filed, triaged,
              resolved) is enough to prove the report wasn't ignored. */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
              Journey
            </p>
            <ul className="text-xs text-secondary space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                Filed —{" "}
                <span className="text-muted">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </li>
              {row.triaged_at && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-arc-300" />
                  Triaged —{" "}
                  <span className="text-muted">
                    {new Date(row.triaged_at).toLocaleString()}
                  </span>
                </li>
              )}
              {row.resolved_at && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Resolved —{" "}
                  <span className="text-muted">
                    {new Date(row.resolved_at).toLocaleString()}
                  </span>
                </li>
              )}
              {!row.triaged_at && !row.resolved_at && (
                <li className="text-muted italic">
                  Waiting for an admin to triage on the §3.1 chain.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
