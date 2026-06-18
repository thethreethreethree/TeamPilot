"use client";

import TopBar from "@/components/layout/TopBar";
import AwaitingEvidence from "@/components/ui/AwaitingEvidence";
import { SkeletonRow } from "@/components/ui/Skeleton";
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
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { InstallTeamChatBanner } from "@/components/pwa/InstallTeamChatBanner";
import { LearningHint } from "@/components/learning/LearningHint";

interface DailyQuestions {
  todaysQuestions: string[];
  uncertainties: string[];
  thingsWorthNoticing: string[];
}

/** C.A.R.E counts shown only when the tenant has support
 *  activity. Per TT.md A21 — Command Center is the
 *  operational hub; support state belongs here. */
interface CareStats {
  hasActivity: boolean;
  openCount: number;
  needsGuidanceCount: number;
  awaitingFirstReplyCount: number;
  dueDurabilityCount: number;
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
  const [careStats, setCareStats] = useState<CareStats | null>(null);
  const [loading, setLoading] = useState(true);
  /** Per TT.md A21 Command Center audit — honest surfacing of
   *  loader failures. Without this, a failed query rendered as
   *  "0 tasks / 0 signals" indistinguishable from a fresh
   *  tenant, which is §A11 dishonesty. */
  const [loadError, setLoadError] = useState<string[]>([]);

  // AI question generator
  const [questions, setQuestions] = useState<DailyQuestions | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  const refresh = async () => {
    setLoading(true);
    const [t, s, p, r, careRes] = await Promise.all([
      fetchTasks(),
      fetchSignals({ sinceDays: 30 }),
      fetchProblems(),
      fetchResolutions(),
      // Per TT.md A21 — C.A.R.E activity surfaced on Command
      // Center for tenants running support. Best-effort; the
      // section hides itself when stats is null OR hasActivity
      // is false, so the page is unchanged for tenants who
      // haven't touched C.A.R.E yet.
      fetch("/api/dashboard/care-stats")
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data) => (data?.stats as CareStats | null) ?? null
        )
        .catch(() => null),
    ]);
    setTasks(t.tasks);
    setTasksMode(t.mode);
    setSignalCount(s.signals.length);
    setSignalsMode(s.mode);
    setProblems(p.problems);
    setResolutions(r.resolutions);
    setCareStats(careRes);
    // Honest aggregation of loader errors. A failure becomes
    // a banner the user can see + retry from, not a silent zero.
    const errs: string[] = [];
    if (t.mode === "live-error") errs.push("tasks");
    if (s.mode === "live-error") errs.push("signals");
    if (p.mode === "live-error") errs.push("problems");
    if (r.mode === "live-error") errs.push("resolutions");
    setLoadError(errs);
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
        <InstallTeamChatBanner />
        {/* Honest loader-failure banner. Per TT.md A21
            Command Center audit — silent failures dressed
            up as live-empty would be the §A11 dishonesty
            failure mode. */}
        {loadError.length > 0 && !loading && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 flex items-center gap-3">
            <Activity
              className="w-3.5 h-3.5 text-amber-300 shrink-0"
              aria-hidden
            />
            <p className="text-xs text-amber-200 leading-relaxed flex-1">
              Couldn&apos;t load: {loadError.join(", ")}. The numbers
              below may be incomplete. Showing what loaded.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="text-[11px] text-amber-200 hover:text-amber-100 underline"
            >
              Retry
            </button>
          </div>
        )}
        {/* The §3.1 chain at a glance — real numbers only */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <LearningHint
            category="Chain · Operations"
            title="Open tasks"
            whatItIs="The total number of tasks currently in flight — anything not yet completed or deleted. Includes To Do, In Progress, Blocked, and Needs Review."
            why="A task in ELOSTATE isn't just a ticket. It's a unit of work tied to the reasoning that produced it — the signals it derived from, the problem it might be addressing, the decision that spawned it. The count is the team's active load measured the only way that matters: count of unresolved threads, not count of meetings or messages."
            how="Click the card to open the Operations board. Use this number to gauge whether the team is over-loaded (more open tasks than the team can credibly close this week) or starving. Spikes deserve a question, not a reaction."
            principle="Capacity is a count of open threads, not a count of activity. A team with 200 open tasks and no closes isn't busy — it's stuck."
          >
            <ChainStat
              label="Open tasks"
              value={tasks.length}
              icon={<ListChecks className="w-3.5 h-3.5" />}
              href="/dashboard/operations"
              loading={loading}
              mode={tasksMode === "demo-fixtures" ? "demo" : "live"}
            />
          </LearningHint>
          <LearningHint
            category="Chain · §3.1"
            title="Signals (30d)"
            whatItIs="Count of signals derived automatically from team events over the last 30 days. Signals are the System's neutral observations — a task slipped, a meeting overran, a customer reopened, a deadline shifted. They are not problems yet; they are the evidence problems get built from."
            why="The constitutional discipline (§3.2 Understanding Gate) refuses to surface a problem until it has enough signals to be real. Without a healthy signal stream, the System has nothing to reason from and stays silent. The signal count tells you whether the chain has the raw material to do its job."
            how="A low number on a fresh tenant is normal — signals accumulate as the team works. A persistently low number on an established tenant is a sign the team isn't generating events the System can read; the work is happening invisibly to the chain. Click to open Living Diagnosis and see which signals exist + what they're pointing at."
            principle="Signals are not problems. They are the raw material problems get earned from. A team without signals has a System that cannot reason."
          >
            <ChainStat
              label="Signals (30d)"
              value={signalCount}
              icon={<Activity className="w-3.5 h-3.5" />}
              href="/dashboard/diagnose"
              loading={loading}
              mode={signalsMode === "demo-fixtures" ? "demo" : "live"}
            />
          </LearningHint>
          <LearningHint
            category="Chain · §3.2"
            title="Open problems"
            whatItIs="Count of problems the team has stated, split into 'draft' (still being worked into a diagnosis) and 'surfaced' (passed the §3.2 evidence threshold and ready for action). A problem in ELOSTATE is a named pattern, supported by signals, with an explicit diagnosis — not just a complaint."
            why="The Understanding Gate (§3.2) is the System's structural refusal to promote a half-understood problem to team attention. Draft problems are problems the team is still earning the right to surface. Surfaced problems are ones that crossed the gate. The split keeps you honest — you see the work-in-progress AND what's actually ready to act on, separately."
            how="Click to open the Problem board. A high draft count with a low surfaced count means the team is articulating concerns but hasn't yet collected enough evidence to act on them. That's the gate doing its job, not a bug. A surfaced problem deserves your attention — the System only promotes it after the discipline is met."
            principle="A problem promoted before it has earned the right to be named is the most expensive kind of work. The gate exists because organizations rediscover the same failure shape until they encode it structurally."
          >
            <ChainStat
              label="Open problems"
              value={draftProblems.length + surfacedProblems.length}
              sub={`${draftProblems.length} draft · ${surfacedProblems.length} surfaced`}
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              href="/dashboard/problems"
              loading={loading}
              mode="live"
            />
          </LearningHint>
          <LearningHint
            category="Chain · §3.5"
            title="Resolutions"
            whatItIs="Count of resolved problems with captured reasoning. The 'reviewed' sub-count is the subset where the §3.5 durability check has been recorded (held / reopened / partial / inconclusive). A resolution without a review is incomplete from the System's perspective — the team claimed it worked but didn't measure."
            why="Closing a ticket is easy. Knowing whether the closure HELD is hard, and it's the only thing that distinguishes a team that compounds from a team that just gets busier. Resolutions tracked WITHOUT durability metrics are the failure mode every productivity tool ships and never measures."
            how="Click to open Resolutions. Look at the reviewed ratio — a team with 30 resolutions and 2 reviewed is closing without measuring. Walk through unreviewed resolutions older than 7 days; the §3.5 check is overdue. The act of recording the outcome is more valuable than the closure itself."
            principle="A resolution that wasn't measured against its alternative is a story, not a result."
          >
            <ChainStat
              label="Resolutions"
              value={resolutions.length}
              sub={`${reviewedResolutions.length} reviewed`}
              icon={<Sparkles className="w-3.5 h-3.5" />}
              href="/dashboard/resolutions"
              loading={loading}
              mode="live"
            />
          </LearningHint>
          <LearningHint
            category="Chain · §3.5"
            title="Held rate"
            whatItIs="Percentage of reviewed resolutions that held (vs reopened / partial / inconclusive). The denominator is always shown — 12 of 18 means 18 reviewed, 12 held. A dash (—) means no resolutions have been reviewed yet."
            why="This is the SINGLE most consequential metric on the page. Every other number is activity; this one is consequence. A team with high held rate is a team where the reasoning behind resolutions is sound. A team with low held rate is rediscovering the same problem cycle after cycle and treating that as work."
            how="A first-pass benchmark: above 70% held is healthy, 50-70% is normal during a learning period, below 50% sustained means the team's resolutions aren't addressing root causes. Click to drill into the resolutions and see which ones reopened — patterns there usually reveal a missing diagnosis upstream."
            principle="Measure consequence, not agreement. A resolution everyone loved that didn't hold is failure. A resolution someone resisted that did hold is success."
          >
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
          </LearningHint>
        </div>

        {/* C.A.R.E surface — hidden unless tenant has support
            activity. Per TT.md A21 — Command Center is the
            operational hub; support state is operational. */}
        {careStats?.hasActivity && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <LearningHint
              category="C.A.R.E"
              title="Open conversations"
              whatItIs="Count of customer conversations that aren't yet resolved or closed — status is new, open, assigned, or waiting. Includes every channel: web widget, email, voice."
              why="Customer support is the most-time-sensitive surface in the company. A growing open conversation count means demand is outpacing the team's resolution rate. The number sits on the Command Center because support state is operational — the founder's daily decisions should include it, not require navigating to a separate module."
              how="Click to open the C.A.R.E inbox. A rising number across days, without a corresponding rise in resolved count, is the first signal of support being underwatered. Pair this with Awaiting first reply (next tile) to see whether the slowness is at intake or at resolution."
              principle="Hubs that don't surface support state make support invisible to leadership until it's a crisis. ELOSTATE refuses to let that happen."
            >
              <ChainStat
                label="Open conversations"
                value={careStats.openCount}
                icon={<MessageCircle className="w-3.5 h-3.5" />}
                href="/dashboard/care"
                loading={false}
                mode="live"
              />
            </LearningHint>
            <LearningHint
              category="C.A.R.E"
              title="Awaiting first reply"
              whatItIs="Subset of open conversations where status is 'new' — meaning a customer messaged in and no agent has touched it yet. This is the most time-sensitive number in C.A.R.E."
              why="First-reply time is the dominant predictor of customer satisfaction in support. A conversation that sits in 'new' for hours is silently spending the team's reputation. Highlighted amber when count is above zero specifically because zero is the right state at the end of every working hour."
              how="Click to open the inbox filtered to status='new'. If this number is above zero during business hours, the operating decision is: who claims it now? Routing through the assignment dropdown beats hoping someone picks it up."
              principle="Time-to-first-reply is the support equivalent of meeting time — once spent, you don't get it back. The team's discipline shows in whether this number returns to zero each day."
            >
              <ChainStat
                label="Awaiting first reply"
                value={careStats.awaitingFirstReplyCount}
                sub={
                  careStats.awaitingFirstReplyCount > 0
                    ? "most time-sensitive"
                    : "all touched"
                }
                icon={<Activity className="w-3.5 h-3.5" />}
                href="/dashboard/care?status=new"
                loading={false}
                mode="live"
                color={
                  careStats.awaitingFirstReplyCount > 0
                    ? "text-amber-400"
                    : "text-emerald-400"
                }
              />
            </LearningHint>
            <LearningHint
              category="C.A.R.E · §A18"
              title="Needs guidance"
              whatItIs="Count of conversations where an agent has flagged 'supervisor guidance requested' — they need a leader to weigh in on the next move. Visible to CEO / COO / admin only; surfaces in the notifications inbox as well."
              why="A team that doesn't have a way to flag 'this needs a senior eye' produces two failure modes: agents guess and lose the customer, or agents escalate every hard case to leadership in DMs. The structural request avoids both — it routes the request through the chain so it's audited, attributed, and visible at the leadership level the same way every other operational signal is."
              how="Click to open the inbox filtered to needs-guidance. Open the conversation, read the thread, and weigh in (or assign it to the right person). The agent asked because the next move wasn't obvious to them — the leadership question is what to model so they recognize the shape next time."
              principle="Escalation is structural, not tribal. If your team has to know to DM the right person, you don't have a system — you have a dependency on social capital."
            >
              <ChainStat
                label="Needs guidance"
                value={careStats.needsGuidanceCount}
                sub={
                  careStats.needsGuidanceCount > 0
                    ? "supervisor requested"
                    : "none flagged"
                }
                icon={<ShieldCheck className="w-3.5 h-3.5" />}
                href="/dashboard/care?filter=needs-guidance"
                loading={false}
                mode="live"
                color={
                  careStats.needsGuidanceCount > 0
                    ? "text-amber-400"
                    : "text-muted"
                }
              />
            </LearningHint>
            <LearningHint
              category="C.A.R.E · §3.5"
              title="Due durability checks"
              whatItIs="Count of resolutions captured in C.A.R.E that have hit their 7-day re-review mark and haven't been recorded yet. The §3.5 constitutional loop applied to customer support: agents resolve, the System schedules a re-check, the agent records held / reopened / inconclusive when the check comes due."
              why="The same problem ELOSTATE solves for internal operations applies even more sharply to customer support: 'did the fix hold' is a question every other support tool ignores. C.A.R.E captures resolutions WITH the question structurally enforced. The due-durability count is the System reminding the team that some closures haven't been measured yet."
              how="Click to open the inbox filtered to due-durability. Open the conversation, look at the customer's activity since you resolved it (did they come back? did they reopen? did they reply with a follow-up?), and record the verdict. The act of recording is more valuable than the closure itself."
              principle="A resolution declared-and-forgotten is the failure mode every support tool ships. Measuring durability is the discipline that compounds capability instead of just closing tickets."
            >
              <ChainStat
                label="Due durability checks"
                value={careStats.dueDurabilityCount}
                sub={
                  careStats.dueDurabilityCount > 0
                    ? "review the §3.5 outcome"
                    : "all caught up"
                }
                icon={<Lightbulb className="w-3.5 h-3.5" />}
                href="/dashboard/care?filter=due-durability"
                loading={false}
                mode="live"
                color={
                  careStats.dueDurabilityCount > 0
                    ? "text-amber-400"
                    : "text-emerald-400"
                }
              />
            </LearningHint>
          </div>
        )}

        {/* Quickstart — real, state-derived suggestion */}
        {quickstart && (
          <LearningHint
            as="block"
            category="Quickstart"
            title="Where to focus next"
            whatItIs="A state-derived suggestion for the most consequential next action — not a recommendation in the §3.3 'overtake' sense, but a navigational hint based on what's actually in the chain right now."
            why="The blank-state problem for any operating tool is: 'I'm here, what do I do?' Generic 'take a tour' overlays are condescending and don't reflect the team's actual state. This panel reads the live data — how many tasks exist, how many signals, whether problems are in draft, whether resolutions are awaiting review — and points at the next stage in the chain that needs work."
            how="Treat it as a SIGNAL, not an instruction. The CTA opens the relevant module. If your team's real priority is different (a customer crisis, a meeting in 30 minutes), trust your judgment over the panel's pointer. The panel goes silent once the chain is mature; that's the right behavior."
            principle="A useful nudge points at where the work is, not at what to do with it. The judgment is yours."
          >
            <div className="glass-card p-5 border-ember-400/30">
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
          </LearningHint>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Open Questions */}
          <div className="lg:col-span-2 space-y-5">
            <div className="glass-card p-5 border-ember-400/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CircleHelp className="w-4 h-4 text-brand" />
                  <h2 className="text-sm font-semibold text-primary">
                    Today&apos;s Open Questions
                  </h2>
                  <span className="text-[10px] font-medium text-brand bg-ember-400/10 border border-ember-400/20 px-2 py-0.5 rounded-full">
                    Guide, don&apos;t overtake
                  </span>
                </div>
                <LearningHint
                  category="AI · §3.3"
                  title="Surface questions (daily briefing)"
                  whatItIs="On-demand briefing that asks the System to surface today's open questions, uncertainties, and things worth noticing — based on the live chain state. The output is structured into three categories and streams in real time as the LLM generates it."
                  why="Every other 'AI dashboard' product on the market generates verdicts: 'Here's what you should do.' The System refuses that frame structurally. The briefing surfaces what's worth holding open — the questions the executive should be carrying today — and explicitly ends every uncertainty with 'looking for X would sharpen the picture.' The forbidden words are 'recommend,' 'should,' 'must.' If they appeared, the System would be overtaking. They don't."
                  how="Click when you want a read of today's state from the System. The output streams over ~5-10 seconds. Read it as a SECOND OPINION on what you're already attending to, not as a to-do list. If the surfaced questions match what you'd hold open anyway, the chain is calibrated. If they're way off, the chain has incomplete data — the gap is more interesting than the briefing itself."
                  principle="A briefing that tells you what to do is a briefing that has overtaken your judgment. The right briefing surfaces what's worth holding open and trusts you to decide."
                >
                  <button
                    type="button"
                    onClick={surfaceQuestions}
                    disabled={loadingBriefing}
                    className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-ember-400/30 hover:border-ember-400/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
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
                </LearningHint>
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
                // Skeleton rows so the user sees the SHAPE of
                // what's coming instead of a centered spinner
                // (which on slow connections reads as 'stuck').
                <div>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
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
                          {task.status === "Blocked" && (
                            <p className="text-xs text-red-400 mt-0.5 truncate">
                              Blocker:{" "}
                              {task.blockerReason?.trim() ||
                                "no reason captured"}
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
