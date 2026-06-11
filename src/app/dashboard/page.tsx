"use client";

import TopBar from "@/components/layout/TopBar";
import AwaitingEvidence from "@/components/ui/AwaitingEvidence";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { fetchTasks, type FetchTasksMode, type Task } from "@/lib/data/tasks";
import { fetchSignals, type SignalsMode } from "@/lib/data/signals";
import { fetchProblems, type ProblemRecord } from "@/lib/data/problems";
import { fetchResolutions, type ResolutionRecord } from "@/lib/data/resolutions";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  Activity,
  ChevronRight,
  CircleHelp,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DailyQuestions {
  todaysQuestions: string[];
  uncertainties: string[];
  thingsWorthNoticing: string[];
}

export default function CommandDashboard() {
  const companyName = useCompanyName();

  // Real-state loaders — no mock fallback in live mode
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksMode, setTasksMode] = useState<FetchTasksMode>("live-empty");
  const [signalCount, setSignalCount] = useState(0);
  const [signalsMode, setSignalsMode] = useState<SignalsMode>("live-empty");
  const [problems, setProblems] = useState<ProblemRecord[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // AI question generator
  const [questions, setQuestions] = useState<DailyQuestions | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  const refresh = async () => {
    setLoading(true);
    const [t, s, p, r] = await Promise.all([
      fetchTasks(),
      fetchSignals({ sinceDays: 30 }),
      fetchProblems(),
      fetchResolutions(),
    ]);
    setTasks(t.tasks);
    setTasksMode(t.mode);
    setSignalCount(s.signals.length);
    setSignalsMode(s.mode);
    setProblems(p.problems);
    setResolutions(r.resolutions);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const [streamProgress, setStreamProgress] = useState(0);

  const surfaceQuestions = async () => {
    setLoadingBriefing(true);
    setBriefingError("");
    setQuestions(null);
    setStreamProgress(0);

    try {
      const res = await fetch("/api/ai/briefing/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks,
          signalCount,
          problemCount: problems.length,
          resolutionCount: resolutions.length,
          companyName,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let textBuf = "";
      let parseBuf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuf += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = textBuf.indexOf("\n\n")) !== -1) {
          const rawEvent = textBuf.slice(0, sep);
          textBuf = textBuf.slice(sep + 2);
          let evt = "message";
          let data = "";
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event: ")) evt = line.slice(7).trim();
            else if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!data) continue;
          let payload: { text?: string; suppressed?: boolean; reason?: string; parsed?: unknown; error?: string };
          try { payload = JSON.parse(data); } catch { continue; }

          if (evt === "delta" && payload.text) {
            parseBuf += payload.text;
            setStreamProgress((p) => p + payload.text!.length);
            // Try partial parse as it streams; if successful, render incrementally.
            try {
              const partial = JSON.parse(parseBuf);
              if (partial && typeof partial === "object") {
                setQuestions(partial as DailyQuestions);
              }
            } catch { /* not yet valid; wait for more */ }
          } else if (evt === "gate" && payload.suppressed) {
            setBriefingError(payload.reason ?? "AI guidance suppressed.");
          } else if (evt === "done") {
            if (payload.parsed && typeof payload.parsed === "object") {
              setQuestions(payload.parsed as DailyQuestions);
            }
          } else if (evt === "error") {
            throw new Error(payload.error ?? "stream error");
          }
        }
      }
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : "Unable to generate.");
    } finally {
      setLoadingBriefing(false);
    }
  };

  const blockedTasks = tasks.filter((t) => t.status === "Blocked");
  const criticalTasks = tasks.filter((t) => t.priority === "Critical");
  const draftProblems = problems.filter((p) => p.status === "draft");
  const surfacedProblems = problems.filter((p) => p.status === "surfaced");
  const reviewedResolutions = resolutions.filter((r) => r.durability !== null);
  const heldRate =
    reviewedResolutions.length === 0
      ? null
      : reviewedResolutions.filter((r) => r.durability === "held").length /
        reviewedResolutions.length;

  // Quickstart suggestion — based on real state, not asserted
  const quickstart = deriveQuickstart({
    tasksMode,
    tasksCount: tasks.length,
    signalCount,
    problemsCount: problems.length,
    resolutionsCount: resolutions.length,
    supabaseEnabled,
  });

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Command Center" subtitle={companyName} />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* The §3.1 chain at a glance — real numbers only */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <ChainStat
            label="Open tasks"
            value={tasks.length}
            icon={<ListChecks className="w-3.5 h-3.5" />}
            href="/dashboard/operations"
            loading={loading}
            mode={tasksMode === "demo-fixtures" ? "demo" : "live"}
          />
          <ChainStat
            label="Signals (30d)"
            value={signalCount}
            icon={<Activity className="w-3.5 h-3.5" />}
            href="/dashboard/diagnose"
            loading={loading}
            mode={signalsMode === "demo-fixtures" ? "demo" : "live"}
          />
          <ChainStat
            label="Open problems"
            value={draftProblems.length + surfacedProblems.length}
            sub={`${draftProblems.length} draft · ${surfacedProblems.length} surfaced`}
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            href="/dashboard/problems"
            loading={loading}
            mode="live"
          />
          <ChainStat
            label="Resolutions"
            value={resolutions.length}
            sub={`${reviewedResolutions.length} reviewed`}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            href="/dashboard/resolutions"
            loading={loading}
            mode="live"
          />
          <ChainStat
            label="Held rate"
            value={heldRate === null ? "—" : `${Math.round(heldRate * 100)}%`}
            sub={
              heldRate === null
                ? "no reviews yet"
                : `${reviewedResolutions.filter((r) => r.durability === "held").length} of ${reviewedResolutions.length}`
            }
            icon={<Lightbulb className="w-3.5 h-3.5" />}
            href="/dashboard/resolutions"
            loading={loading}
            mode="live"
            color={heldRate === null ? "text-muted" : "text-emerald-400"}
          />
        </div>

        {/* Quickstart — real, state-derived suggestion */}
        {quickstart && (
          <div className="glass-card p-5 border-[#FACC15]/30">
            <p className="text-[10px] text-brand uppercase tracking-widest mb-2">
              Where to focus next
            </p>
            <p className="text-sm text-primary mb-2">{quickstart.title}</p>
            <p className="text-xs text-secondary leading-relaxed mb-3">
              {quickstart.body}
            </p>
            <Link
              href={quickstart.href}
              className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-primary"
            >
              {quickstart.cta} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Open Questions */}
          <div className="lg:col-span-2 space-y-5">
            <div className="glass-card p-5 border-[#FACC15]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CircleHelp className="w-4 h-4 text-brand" />
                  <h2 className="text-sm font-semibold text-primary">
                    Today&apos;s Open Questions
                  </h2>
                  <span className="text-[10px] font-medium text-brand bg-[#FACC15]/10 border border-[#FACC15]/20 px-2 py-0.5 rounded-full">
                    Guide, don&apos;t overtake
                  </span>
                </div>
                <button
                  onClick={surfaceQuestions}
                  disabled={loadingBriefing}
                  className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-[#FACC15]/30 hover:border-[#FACC15]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  aria-live="polite"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${loadingBriefing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {loadingBriefing
                    ? streamProgress > 0
                      ? `Streaming… ${streamProgress} chars`
                      : "Connecting…"
                    : "Surface questions"}
                </button>
              </div>

              {questions ? (
                <div className="space-y-4">
                  <Section
                    icon={<CircleHelp className="w-3 h-3" />}
                    label="Questions worth holding open today"
                    items={questions.todaysQuestions}
                    tone="violet"
                  />
                  <Section
                    icon={<Sparkles className="w-3 h-3" />}
                    label="Things worth noticing"
                    items={questions.thingsWorthNoticing}
                    tone="blue"
                  />
                  <Section
                    icon={<Lightbulb className="w-3 h-3" />}
                    label="Uncertainties — would benefit from more signal"
                    items={questions.uncertainties}
                    tone="amber"
                  />
                </div>
              ) : briefingError ? (
                <p className="text-xs text-red-400">{briefingError}</p>
              ) : (
                <AwaitingEvidence
                  domain="executive"
                  hint="Click 'Surface questions' to ask the System what's worth holding open today. The System will surface questions and uncertainties — it will not tell you what to do."
                />
              )}
            </div>

            {/* Critical & Blocked Tasks — from REAL tasks, honest empty state */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-semibold text-primary">
                    Critical & blocked tasks
                  </h2>
                  <span className="text-xs font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                    {blockedTasks.length + criticalTasks.length}
                  </span>
                </div>
                <Link
                  href="/dashboard/operations"
                  className="text-xs text-muted hover:text-brand flex items-center gap-1 transition-colors"
                >
                  All tasks <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted py-6 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : blockedTasks.length + criticalTasks.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">
                  No blocked or critical tasks right now.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {[...blockedTasks, ...criticalTasks]
                    .filter(
                      (t, i, arr) => arr.findIndex((x) => x.id === t.id) === i
                    )
                    .slice(0, 4)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl bg-surface border border-default hover:border-strong transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary truncate">
                            {task.title}
                          </p>
                          {task.blockerReason && (
                            <p className="text-xs text-red-400 mt-0.5 truncate">
                              Blocker: {task.blockerReason}
                            </p>
                          )}
                          {task.assignee && (
                            <p className="text-xs text-muted mt-0.5">
                              {task.assignee}
                              {task.dueDate ? ` · Due ${task.dueDate}` : ""}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                          {task.status === "Blocked" ? task.status : task.priority}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — Surfaced problems + recent resolutions */}
          <div className="space-y-5">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-violet-300" />
                <h2 className="text-sm font-semibold text-primary">
                  Surfaced problems
                </h2>
              </div>
              {loading ? (
                <p className="text-xs text-muted py-3">Loading…</p>
              ) : surfacedProblems.length === 0 ? (
                <p className="text-xs text-muted leading-relaxed">
                  None today. A problem only surfaces here once it links to ≥3 signals
                  from ≥2 distinct sources AND a stated diagnosis — silence here means
                  the gate is doing its job, not that nothing is happening.
                </p>
              ) : (
                <div className="space-y-2">
                  {surfacedProblems.slice(0, 4).map((p) => (
                    <Link
                      key={p.id}
                      href="/dashboard/problems"
                      className="block p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 hover:border-violet-500/40 transition-colors"
                    >
                      <p className="text-sm text-primary">{p.title}</p>
                      <p className="text-[10px] text-violet-300/70 mt-1 font-mono">
                        {p.kind} · {p.signalCount} signal
                        {p.signalCount === 1 ? "" : "s"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-primary">
                    Recent resolutions
                  </h2>
                </div>
                <Link
                  href="/dashboard/resolutions"
                  className="text-xs text-muted hover:text-brand flex items-center gap-1"
                >
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <p className="text-xs text-muted py-3">Loading…</p>
              ) : resolutions.length === 0 ? (
                <p className="text-xs text-muted leading-relaxed">
                  No resolutions yet. They appear here when a problem is closed via the
                  Living Diagnosis flow.
                </p>
              ) : (
                <div className="space-y-2">
                  {resolutions.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-surface border border-default"
                    >
                      <p className="text-xs text-primary line-clamp-2">
                        {r.actionTaken}
                      </p>
                      <p className="text-[10px] text-muted mt-1 font-mono">
                        {r.decidedAt.slice(0, 10)}
                        {r.durability
                          ? ` · ${r.durability}`
                          : " · awaiting review"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function ChainStat({
  label,
  value,
  sub,
  icon,
  href,
  loading,
  mode,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  href: string;
  loading: boolean;
  mode: "demo" | "live";
  color?: string;
}) {
  return (
    <Link
      href={href}
      className="glass-card p-3 flex flex-col gap-1 hover:border-strong transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-widest">
        <span className="text-brand">{icon}</span>
        {label}
        {mode === "demo" && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-[8px] font-semibold tracking-widest">
            DEMO
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold ${color ?? "text-primary"}`}>
        {loading ? "—" : value}
      </p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </Link>
  );
}

function Section({
  icon,
  label,
  items,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  tone: "violet" | "blue" | "amber";
}) {
  if (!items || items.length === 0) return null;
  const styles = {
    violet: "text-violet-300 border-violet-500/20 bg-violet-500/5",
    blue: "text-blue-300 border-blue-500/20 bg-blue-500/5",
    amber: "text-amber-300 border-amber-500/20 bg-amber-500/5",
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${styles}`}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-2">
        {icon}
        {label}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-primary leading-relaxed">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function deriveQuickstart(state: {
  tasksMode: FetchTasksMode;
  tasksCount: number;
  signalCount: number;
  problemsCount: number;
  resolutionsCount: number;
  supabaseEnabled: boolean;
}): { title: string; body: string; cta: string; href: string } | null {
  if (!state.supabaseEnabled) {
    return {
      title: "You're in demo mode.",
      body: "What you see is the design — no data persists, no events accumulate. Configure Supabase keys in .env.local (and run migrations 0001–0007) to use the production chain.",
      cta: "Read the local dev guide",
      href: "/",
    };
  }
  if (state.tasksMode === "live-empty" && state.tasksCount === 0) {
    return {
      title: "Start the chain — create your first task.",
      body: "Tasks emit events. Events derive signals. Signals accumulate into patterns. Patterns earn the right to surface as problems. None of that begins until at least one task exists.",
      cta: "Open Tasks",
      href: "/dashboard/operations",
    };
  }
  if (state.signalCount < 3) {
    return {
      title: "Tasks exist; the chain is warming up.",
      body: `${state.signalCount} signal${state.signalCount === 1 ? "" : "s"} so far. The Understanding Gate needs ≥3 from ≥2 distinct sources before any problem can surface. Keep working — the chain accumulates with each status change, reassignment, and blocker.`,
      cta: "See Living Diagnosis",
      href: "/dashboard/diagnose",
    };
  }
  if (state.problemsCount === 0) {
    return {
      title: "Signals are accumulating. Time to state a hypothesis.",
      body: "You can begin a problem draft now. Link the signals that point at it, write the WHY, and the gate will tell you what's still missing before it can surface.",
      cta: "Open Problems",
      href: "/dashboard/problems",
    };
  }
  if (state.resolutionsCount === 0) {
    return {
      title: "Problems on file — walk one to resolution.",
      body: "Open Living Diagnosis and run a problem through the loop. The System surfaces alternatives, traces ripples, and closes the loop atomically when you commit.",
      cta: "Open Living Diagnosis",
      href: "/dashboard/diagnose",
    };
  }
  return {
    title: "The chain is running. Review outcomes to measure consequence.",
    body: "Resolutions need observed outcomes filled in to measure whether they held. That review is what §3.5 calls measuring consequence, not agreement.",
    cta: "Review resolutions",
    href: "/dashboard/resolutions",
  };
}
