"use client";

import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { fetchSignals, type SignalsMode } from "@/lib/data/signals";
import { supabaseEnabled } from "@/lib/supabase/client";
import { loadRun, saveRun, clearRun } from "@/lib/diagnosis/persistence";
import {
  DIAGNOSIS_STEPS,
  canAdvance,
  deriveRetrospectivePatterns,
  describeGapToGate,
  evaluateUnderstandingGate,
  summarizeEvidence,
  type CandidateResolution,
  type DiagnosisRun,
  type DiagnosisStep,
  type GateEvaluation,
  type OutsideViewReading,
  type RetrospectivePattern,
  type RippleEffect,
  type SignalRef,
} from "@/lib/diagnosis";
import {
  Activity,
  ChevronRight,
  CircleHelp,
  Eye,
  GitMerge,
  Layers,
  Lightbulb,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STEP_META: Record<
  DiagnosisStep,
  { label: string; icon: React.ComponentType<{ className?: string }>; section: string }
> = {
  data: { label: "Data-as-Asset", icon: Layers, section: "§1.1" },
  retrospective: { label: "Retrospective", icon: Activity, section: "§1.2" },
  outsideView: { label: "Outside View", icon: Eye, section: "§1.3" },
  gate: { label: "Understanding Gate", icon: ShieldCheck, section: "§3.2" },
  rippleTrace: { label: "Ripple Trace", icon: GitMerge, section: "§1.5" },
  decide: { label: "Decide", icon: Lightbulb, section: "§3.3" },
  close: { label: "Close the Loop", icon: Sparkles, section: "§1.6" },
};

const emptyRun: DiagnosisRun = {
  id: "run-local",
  startedAt: new Date(0).toISOString(),
  situation: "",
  retrospective: [],
  outsideViews: [],
  problemHypothesis: null,
  gate: null,
  candidates: [],
};

export default function DiagnosePage() {
  const companyName = useCompanyName();
  const [run, setRun] = useState<DiagnosisRun>({
    ...emptyRun,
    startedAt: "demo-start",
  });
  const [step, setStep] = useState<DiagnosisStep>("data");
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);

  // Step 1 — Data (real signals from DB; demo fixtures only when Supabase off)
  const [signals, setSignals] = useState<SignalRef[]>([]);
  const [signalsMode, setSignalsMode] = useState<SignalsMode>("live-empty");
  const [loadingSignals, setLoadingSignals] = useState(false);

  const loadSignals = async () => {
    setLoadingSignals(true);
    const res = await fetchSignals({ sinceDays: 30 });
    setSignals(res.signals);
    setSignalsMode(res.mode);
    setLoadingSignals(false);
  };

  // Restore from localStorage on mount.
  useEffect(() => {
    const persisted = loadRun();
    if (persisted) {
      setRun(persisted.run);
      setRestoredFrom(persisted.savedAt);
    }
    loadSignals();
  }, []);

  // Auto-save on any change to the run.
  useEffect(() => {
    if (run.startedAt === "demo-start" && run.candidates.length === 0 && !run.problemHypothesis) {
      // Empty run — don't churn the storage.
      return;
    }
    saveRun(run);
  }, [run]);

  const resetRun = () => {
    setRun({ ...emptyRun, startedAt: "demo-start" });
    setStep("data");
    setRestoredFrom(null);
    clearRun();
  };

  // Step 3 — Outside view input
  const [currentRead, setCurrentRead] = useState("");
  const [loadingOutside, setLoadingOutside] = useState(false);
  const [outsideError, setOutsideError] = useState("");

  // Step 4 — Hypothesis + gate
  const [hypothesisTitle, setHypothesisTitle] = useState("");
  const [hypothesisKind, setHypothesisKind] = useState("operational_bottleneck");
  const [hypothesisDiagnosis, setHypothesisDiagnosis] = useState("");

  // Step 5 — Candidate action + ripple trace
  const [candidateAction, setCandidateAction] = useState("");
  const [candidateExpected, setCandidateExpected] = useState("");
  const [loadingRipples, setLoadingRipples] = useState(false);
  const [ripples, setRipples] = useState<RippleEffect[] | null>(null);
  const [rippleError, setRippleError] = useState("");

  // Step 6 — Decide
  const [chosenNote, setChosenNote] = useState("");

  const stepIndex = DIAGNOSIS_STEPS.indexOf(step);
  const advance = canAdvance(run, step);

  // Derived values (recomputed live as the run state updates)
  const patterns = useMemo<RetrospectivePattern[]>(
    () => (signals.length > 0 ? deriveRetrospectivePatterns({ signals, events: [] }) : []),
    [signals]
  );

  const liveRun: DiagnosisRun = useMemo(
    () => ({
      ...run,
      retrospective: patterns,
      problemHypothesis: hypothesisTitle.trim()
        ? {
            kind: hypothesisKind,
            title: hypothesisTitle,
            diagnosis: hypothesisDiagnosis,
          }
        : null,
      gate: hypothesisTitle.trim()
        ? evaluateUnderstandingGate({
            signalCount: patterns.reduce((sum, p) => sum + p.occurrences, 0),
            distinctSources: patterns.flatMap((p) => p.distinctSources),
            diagnosis: hypothesisDiagnosis,
          })
        : null,
      candidates:
        ripples && candidateAction.trim()
          ? [
              {
                action: candidateAction,
                reasoning: hypothesisDiagnosis,
                expectedOutcome: candidateExpected,
                predictedRipples: ripples,
              },
            ]
          : [],
    }),
    [
      run,
      patterns,
      hypothesisTitle,
      hypothesisKind,
      hypothesisDiagnosis,
      candidateAction,
      candidateExpected,
      ripples,
    ]
  );


  const requestOutsideView = async () => {
    setLoadingOutside(true);
    setOutsideError("");
    try {
      const res = await fetch("/api/diagnosis/outside-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentRead,
          evidenceSummary: summarizeEvidence(patterns),
          count: 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "outside view failed");
      setRun((r) => ({ ...r, outsideViews: data.readings ?? [] }));
    } catch (err) {
      setOutsideError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingOutside(false);
    }
  };

  const requestRipples = async () => {
    setLoadingRipples(true);
    setRippleError("");
    try {
      const res = await fetch("/api/diagnosis/ripple-trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemTitle: hypothesisTitle,
          diagnosis: hypothesisDiagnosis,
          candidateAction,
          contextSummary: summarizeEvidence(patterns),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ripple trace failed");
      setRipples(data.ripples ?? []);
    } catch (err) {
      setRippleError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingRipples(false);
    }
  };

  const commitChoice = (candidate: CandidateResolution) => {
    setRun((r) => ({ ...r, chosen: candidate }));
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Living Diagnosis"
        subtitle={`${companyName} · The constitution as runtime (CLAUDE.md §1)`}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#5470ff]/5 border border-[#5470ff]/20">
          <Activity className="w-4 h-4 text-[#7a96ff] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#8895c4] leading-relaxed">
            This is the diagnostic discipline operating on your data. The engine refuses to
            advance steps until the constitution&apos;s gates pass — when a step is held,
            it tells you exactly what&apos;s missing. The System guides; you decide.
          </p>
        </div>

        {restoredFrom && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs text-emerald-200">
              Restored from local save ({restoredFrom.slice(0, 19).replace("T", " ")}).
              Continue or reset to start fresh.
            </p>
            <button
              onClick={resetRun}
              className="text-xs text-emerald-200 hover:text-white border border-emerald-500/30 hover:border-emerald-500/60 px-3 py-1 rounded-lg"
            >
              Reset run
            </button>
          </div>
        )}

        {/* Step stepper */}
        <StepStepper current={step} liveRun={liveRun} onJump={setStep} />

        {/* Step canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {step === "data" && (
              <StepCard step="data">
                <p className="text-sm text-[#8895c4] mb-4">
                  Assemble the record. Signals are immutable observations derived from events
                  — the entry point of the loop (§1.1).
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={loadSignals}
                    disabled={loadingSignals}
                    className="text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingSignals ? "animate-spin" : ""}`} />
                    Refresh signals
                  </button>
                  <span className="text-xs text-[#5a6399]">
                    {signals.length} signal{signals.length === 1 ? "" : "s"} ·{" "}
                    {signalsMode === "demo-fixtures"
                      ? "demo fixtures"
                      : signalsMode === "live-empty"
                      ? "live (none yet)"
                      : "live data"}
                  </span>
                </div>
                {signals.length > 0 ? (
                  <ul className="space-y-1 max-h-60 overflow-y-auto pr-2">
                    {signals.map((s) => (
                      <li
                        key={s.id}
                        className="text-xs text-[#8895c4] font-mono p-2 rounded bg-[#12141f] border border-[#252840]"
                      >
                        <span className="text-[#7a96ff]">{s.kind}</span>{" "}
                        <span className="text-[#5a6399]">@ {s.source}</span>{" "}
                        <span className="text-[#3a3f5c]">· {s.observed_at}</span>
                      </li>
                    ))}
                  </ul>
                ) : signalsMode === "live-empty" ? (
                  <EmptyHint
                    text={
                      supabaseEnabled
                        ? "No signals yet. Signals are produced by the events chain — create tasks (which emit events) and the DB derive_signals_for_event() function will populate this stream."
                        : "Demo mode — configure Supabase keys in .env.local to use real signals."
                    }
                  />
                ) : (
                  <EmptyHint text="No demo signals available." />
                )}
              </StepCard>
            )}

            {step === "retrospective" && (
              <StepCard step="retrospective">
                <p className="text-sm text-[#8895c4] mb-4">
                  Look backward (§1.2). Patterns require ≥3 occurrences across ≥2 distinct
                  sources — single observations stay as anecdotes.
                </p>
                {patterns.length === 0 ? (
                  <EmptyHint text="No patterns in the loaded record yet. This is correct — anecdote-level evidence should not become a pattern." />
                ) : (
                  <ul className="space-y-3">
                    {patterns.map((p, i) => (
                      <li
                        key={i}
                        className="p-3 rounded-xl bg-[#12141f] border border-[#252840]"
                      >
                        <p className="text-sm text-[#e8eaf6]">{p.description}</p>
                        <p className="text-[10px] text-[#5a6399] mt-2 font-mono">
                          {p.distinctSources.join(" · ")}
                        </p>
                        <p className="text-[10px] text-[#3a3f5c] mt-1">
                          {p.earliestObserved} → {p.latestObserved}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </StepCard>
            )}

            {step === "outsideView" && (
              <StepCard step="outsideView">
                <p className="text-sm text-[#8895c4] mb-4">
                  Counter tunnel vision (§1.3). State YOUR current read; the System
                  generates alternative framings from a stance with no investment in it.
                </p>
                <textarea
                  value={currentRead}
                  onChange={(e) => setCurrentRead(e.target.value)}
                  placeholder="What do you currently think is going on?"
                  rows={4}
                  className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-3 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors resize-none leading-relaxed mb-3"
                />
                <button
                  onClick={requestOutsideView}
                  disabled={loadingOutside || !currentRead.trim()}
                  className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOutside ? "animate-spin" : ""}`} />
                  {loadingOutside ? "Generating alternatives…" : "Generate outside views"}
                </button>
                {outsideError && (
                  <p className="text-xs text-red-400 mt-2">{outsideError}</p>
                )}
                {run.outsideViews.length > 0 && (
                  <div className="space-y-3 mt-5">
                    {run.outsideViews.map((v: OutsideViewReading, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20"
                      >
                        <p className="text-sm text-[#e8eaf6] mb-2">{v.framing}</p>
                        <p className="text-[10px] text-violet-300 uppercase tracking-widest">
                          challenges
                        </p>
                        <p className="text-xs text-[#8895c4] mb-2">{v.whatItChallenges}</p>
                        <p className="text-[10px] text-violet-300 uppercase tracking-widest">
                          if true then
                        </p>
                        <p className="text-xs text-[#8895c4]">{v.ifTrueThen}</p>
                      </div>
                    ))}
                  </div>
                )}
              </StepCard>
            )}

            {step === "gate" && (
              <StepCard step="gate">
                <p className="text-sm text-[#8895c4] mb-4">
                  State your problem hypothesis. The gate (§3.2) refuses to surface a
                  problem unless evidence + WHY are sufficient.
                </p>
                <div className="space-y-3">
                  <input
                    value={hypothesisTitle}
                    onChange={(e) => setHypothesisTitle(e.target.value)}
                    placeholder="Problem title — one line"
                    className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50"
                  />
                  <input
                    value={hypothesisKind}
                    onChange={(e) => setHypothesisKind(e.target.value)}
                    placeholder="Kind — e.g. operational_bottleneck, financial_risk"
                    className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-2.5 text-sm text-[#8895c4] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 font-mono"
                  />
                  <textarea
                    value={hypothesisDiagnosis}
                    onChange={(e) => setHypothesisDiagnosis(e.target.value)}
                    placeholder="Diagnosis — state the WHY. Required to be ≥80 characters."
                    rows={5}
                    className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-3 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 resize-none"
                  />
                </div>
                {liveRun.gate && <GateBadge gate={liveRun.gate} />}
              </StepCard>
            )}

            {step === "rippleTrace" && (
              <StepCard step="rippleTrace">
                <p className="text-sm text-[#8895c4] mb-4">
                  Propose an action. The System traces what else it affects, with WHY
                  for each ripple (§1.5, §2).
                </p>
                <input
                  value={candidateAction}
                  onChange={(e) => setCandidateAction(e.target.value)}
                  placeholder="Candidate action — what would you do?"
                  className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-2.5 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 mb-3"
                />
                <input
                  value={candidateExpected}
                  onChange={(e) => setCandidateExpected(e.target.value)}
                  placeholder="Expected outcome (your prediction — recorded for §3.5 measurement)"
                  className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-2.5 text-sm text-[#8895c4] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 mb-3"
                />
                <button
                  onClick={requestRipples}
                  disabled={loadingRipples || !candidateAction.trim()}
                  className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRipples ? "animate-spin" : ""}`} />
                  {loadingRipples ? "Tracing ripples…" : "Trace ripples"}
                </button>
                {rippleError && <p className="text-xs text-red-400 mt-2">{rippleError}</p>}
                {ripples && (
                  <div className="space-y-3 mt-5">
                    {ripples.length === 0 ? (
                      <EmptyHint text="No meaningful ripples surfaced. Either the action is genuinely contained, or the context wasn't rich enough to predict ripples." />
                    ) : (
                      ripples.map((r, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-[#12141f] border border-[#252840]"
                        >
                          <p className="text-sm text-[#e8eaf6] mb-1">
                            <span className="font-mono text-xs text-[#7a96ff]">
                              {r.affectedSubject}
                            </span>{" "}
                            — {r.effect}
                          </p>
                          <p className="text-[10px] text-[#5a6399] mt-2 uppercase tracking-widest">
                            confidence: {r.confidence}
                          </p>
                          <p className="text-xs text-[#8895c4] mt-1 italic">why: {r.reasoning}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </StepCard>
            )}

            {step === "decide" && (
              <StepCard step="decide">
                <p className="text-sm text-[#8895c4] mb-4">
                  The decision is yours (§3.3). The engine has surfaced the candidate and
                  its ripples; you commit, hybrid, or defer.
                </p>
                {liveRun.candidates.length === 0 ? (
                  <EmptyHint text="No ripple-traced candidate yet. Go back to step 5 and propose an action." />
                ) : (
                  liveRun.candidates.map((c, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-[#5470ff]/5 border border-[#5470ff]/20 mb-4"
                    >
                      <p className="text-sm font-medium text-[#e8eaf6]">{c.action}</p>
                      <p className="text-[10px] text-[#5a6399] mt-2 uppercase tracking-widest">why</p>
                      <p className="text-xs text-[#8895c4]">{c.reasoning}</p>
                      <p className="text-[10px] text-[#5a6399] mt-2 uppercase tracking-widest">
                        expected outcome
                      </p>
                      <p className="text-xs text-[#8895c4]">{c.expectedOutcome}</p>
                      <p className="text-[10px] text-[#5a6399] mt-2 uppercase tracking-widest">
                        ripples ({c.predictedRipples.length})
                      </p>
                      <p className="text-xs text-[#8895c4]">
                        {c.predictedRipples.map((r) => r.affectedSubject).join(", ") || "none"}
                      </p>
                      <button
                        onClick={() => commitChoice(c)}
                        className="mt-3 flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-semibold px-4 py-2 rounded-lg transition-all text-xs"
                      >
                        Commit to this
                      </button>
                    </div>
                  ))
                )}
                <textarea
                  value={chosenNote}
                  onChange={(e) => setChosenNote(e.target.value)}
                  placeholder="Optional note — what made this the right call from your perspective?"
                  rows={3}
                  className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-3 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 resize-none"
                />
              </StepCard>
            )}

            {step === "close" && (
              <StepCard step="close">
                <p className="text-sm text-[#8895c4] mb-4">
                  Close the loop (§1.6). The resolution is recorded; a problem.resolved
                  event is emitted; the loop feeds back into the chain.
                </p>
                {!liveRun.chosen ? (
                  <EmptyHint text="No commitment yet. Return to Decide and commit to a candidate." />
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-sm font-medium text-emerald-200 mb-2">
                      Ready to persist.
                    </p>
                    <p className="text-xs text-[#8895c4] mb-3">
                      In live mode, this calls the SQL close_problem() function which
                      atomically inserts the resolution, marks the problem resolved, and
                      emits a problem.resolved event into the loop. In demo mode, this is
                      shown for review only.
                    </p>
                    <pre className="text-[10px] text-[#5a6399] bg-[#12141f] p-3 rounded-lg overflow-x-auto">
{JSON.stringify(liveRun.chosen, null, 2)}
                    </pre>
                  </div>
                )}
              </StepCard>
            )}
          </div>

          {/* Right column — engine state / advance gate */}
          <div className="space-y-6">
            <div className="glass-card p-5 border-[#5470ff]/20">
              <p className="text-[10px] text-[#5470ff] uppercase tracking-widest mb-2">
                Engine state
              </p>
              <p className="text-sm text-[#e8eaf6] mb-1">
                Step {stepIndex + 1} of {DIAGNOSIS_STEPS.length}: {STEP_META[step].label}
              </p>
              <p className="text-xs text-[#5a6399]">{STEP_META[step].section}</p>
              <div
                className={`mt-4 p-3 rounded-xl border ${
                  advance.ok
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-yellow-500/5 border-yellow-500/20"
                }`}
              >
                <p
                  className={`text-[10px] uppercase tracking-widest mb-1 ${
                    advance.ok ? "text-emerald-300" : "text-yellow-300"
                  }`}
                >
                  {advance.ok ? "advance allowed" : "engine holds"}
                </p>
                <p className="text-xs text-[#e8eaf6] leading-relaxed">{advance.reason}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => {
                    const target = DIAGNOSIS_STEPS[Math.max(0, stepIndex - 1)];
                    if (target) setStep(target);
                  }}
                  disabled={stepIndex === 0}
                  className="text-xs text-[#5a6399] hover:text-[#8895c4] disabled:opacity-30"
                >
                  ← back
                </button>
                <button
                  onClick={() => {
                    const target = DIAGNOSIS_STEPS[Math.min(DIAGNOSIS_STEPS.length - 1, stepIndex + 1)];
                    if (target) setStep(target);
                  }}
                  disabled={
                    !advance.ok || stepIndex === DIAGNOSIS_STEPS.length - 1
                  }
                  className="flex items-center gap-1 text-xs text-[#7a96ff] hover:text-white disabled:opacity-30"
                >
                  next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="glass-card p-5">
              <p className="text-[10px] text-[#5a6399] uppercase tracking-widest mb-2">
                Loop chain
              </p>
              <ul className="space-y-2 text-xs">
                <ChainRow label="events" value={"— (foundation)"} muted />
                <ChainRow
                  label="signals"
                  value={`${signals.length} loaded`}
                  muted={signals.length === 0}
                />
                <ChainRow
                  label="patterns"
                  value={`${patterns.length} surfaced`}
                  muted={patterns.length === 0}
                />
                <ChainRow
                  label="problem"
                  value={hypothesisTitle ? "stated" : "—"}
                  muted={!hypothesisTitle}
                />
                <ChainRow
                  label="gate"
                  value={
                    liveRun.gate
                      ? liveRun.gate.passes
                        ? "passes"
                        : "holds"
                      : "—"
                  }
                  muted={!liveRun.gate}
                />
                <ChainRow
                  label="ripples"
                  value={ripples ? `${ripples.length} traced` : "—"}
                  muted={!ripples}
                />
                <ChainRow
                  label="resolution"
                  value={liveRun.chosen ? "committed" : "—"}
                  muted={!liveRun.chosen}
                />
              </ul>
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

function StepStepper({
  current,
  liveRun,
  onJump,
}: {
  current: DiagnosisStep;
  liveRun: DiagnosisRun;
  onJump: (s: DiagnosisStep) => void;
}) {
  const currentIndex = DIAGNOSIS_STEPS.indexOf(current);
  return (
    <div className="grid grid-cols-7 gap-2">
      {DIAGNOSIS_STEPS.map((s, i) => {
        const meta = STEP_META[s];
        const Icon = meta.icon;
        const active = s === current;
        const reached = i <= currentIndex;
        const advance = canAdvance(liveRun, s);
        return (
          <button
            key={s}
            onClick={() => onJump(s)}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors text-left ${
              active
                ? "bg-[#5470ff]/15 border-[#5470ff]/50"
                : reached
                ? "border-[#252840] hover:border-[#3a3f5c]"
                : "border-[#252840] opacity-50"
            }`}
            title={advance.reason}
          >
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <Icon
                className={`w-3.5 h-3.5 ${
                  active ? "text-[#7a96ff]" : "text-[#5a6399]"
                }`}
              />
              {!advance.ok && <Lock className="w-2.5 h-2.5 text-yellow-400" />}
            </div>
            <span
              className={`text-[10px] font-medium ${
                active ? "text-[#7a96ff]" : "text-[#8895c4]"
              }`}
            >
              {meta.label}
            </span>
            <span aria-hidden="true" className="text-[9px] text-[#3a3f5c] font-mono">{meta.section}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepCard({
  step,
  children,
}: {
  step: DiagnosisStep;
  children: React.ReactNode;
}) {
  const meta = STEP_META[step];
  const Icon = meta.icon;
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[#5470ff]" />
        <h2 className="text-sm font-semibold text-[#e8eaf6]">{meta.label}</h2>
        <span className="text-[10px] text-[#5a6399] font-mono">{meta.section}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-[#12141f] border border-[#252840]">
      <CircleHelp className="w-4 h-4 text-[#5a6399] flex-shrink-0 mt-0.5" />
      <p className="text-xs text-[#5a6399] leading-relaxed">{text}</p>
    </div>
  );
}

function GateBadge({ gate }: { gate: GateEvaluation }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`mt-4 p-3 rounded-xl border ${
        gate.passes
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-yellow-500/5 border-yellow-500/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck
          aria-hidden="true"
          className={`w-4 h-4 ${gate.passes ? "text-emerald-400" : "text-yellow-400"}`}
        />
        <p
          className={`text-[10px] uppercase tracking-widest ${
            gate.passes ? "text-emerald-300" : "text-yellow-300"
          }`}
        >
          {gate.passes ? "gate passes" : "gate holds"}
        </p>
      </div>
      {/* gate.reason is the natural-language explanation; it's the primary
          content the live region announces. */}
      <p className="text-xs text-[#e8eaf6] mb-2">{gate.reason}</p>
      {!gate.passes && (
        <p className="text-[10px] text-yellow-200">{describeGapToGate(gate)}</p>
      )}
      <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] text-[#5a6399]">
        <div>
          signals: <span className="text-[#8895c4] font-mono">{gate.signalCount}</span> /{" "}
          <span className="font-mono">{gate.threshold.minSignals}</span>
        </div>
        <div>
          sources:{" "}
          <span className="text-[#8895c4] font-mono">{gate.distinctSourceCount}</span> /{" "}
          <span className="font-mono">{gate.threshold.minDistinctSources}</span>
        </div>
        <div>
          chars:{" "}
          <span className="text-[#8895c4] font-mono">{gate.diagnosisCharCount}</span> /{" "}
          <span className="font-mono">{gate.threshold.minDiagnosisChars}</span>
        </div>
      </div>
    </div>
  );
}

function ChainRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted: boolean;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className={`font-mono ${muted ? "text-[#3a3f5c]" : "text-[#8895c4]"}`}>
        {label}
      </span>
      <span className={`text-xs ${muted ? "text-[#3a3f5c]" : "text-[#e8eaf6]"}`}>
        {value}
      </span>
    </li>
  );
}
