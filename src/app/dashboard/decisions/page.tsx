"use client";

import TopBar from "@/components/layout/TopBar";
import { mockCompany } from "@/lib/mock-data";
import { fetchDecisions, type DecisionRecord } from "@/lib/data/decisions";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  GitCompareArrows,
  Lightbulb,
  MessageCircleQuestion,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";

interface DialogueResponse {
  engagement: string;
  addedPerspective: string;
  suggestion: { action: string; why: string };
  comparison: string;
}

type Phase = "situation" | "elicit" | "respond" | "decide";

type Decision =
  | { kind: "user"; note: string }
  | { kind: "system"; note: string }
  | { kind: "hybrid"; note: string }
  | { kind: "defer"; note: string };

const exampleSituation = `Operations efficiency dropped 9% this week. Two critical tasks are blocked — the payment gateway integration and the v2.4 product deploy. Marcus Chen (Lead Engineer) is overloaded with 4 active tasks and 2 overdue items. The v2.4 deploy is blocked until the gateway is fixed. The board wants a status update by Friday — 3 days from now.`;

export default function DecisionsPage() {
  const [phase, setPhase] = useState<Phase>("situation");
  const [situation, setSituation] = useState(exampleSituation);
  const [userDiagnosis, setUserDiagnosis] = useState("");
  const [userProposal, setUserProposal] = useState("");
  const [response, setResponse] = useState<DialogueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [persistMsg, setPersistMsg] = useState("");
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [decisionsAreMock, setDecisionsAreMock] = useState(true);

  useEffect(() => {
    fetchDecisions().then(({ decisions, isMock }) => {
      setDecisions(decisions);
      setDecisionsAreMock(isMock);
    });
  }, []);

  const reset = () => {
    setPhase("situation");
    setUserDiagnosis("");
    setUserProposal("");
    setResponse(null);
    setDecision(null);
    setError("");
    setPersistMsg("");
  };

  const persistDecision = async () => {
    if (!decision || !response) return;
    setPersisting(true);
    setPersistMsg("");
    try {
      const title = (userProposal.split("\n")[0] ?? "Decision").slice(0, 80);
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation,
          userDiagnosis,
          userProposal,
          systemResponse: response,
          chosenPath: decision.kind,
          chosenNote: decision.note,
          title,
          outcome:
            decision.kind === "defer"
              ? "Deferred — understanding not yet earned"
              : decision.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not persist.");
      setPersistMsg(`Persisted (id ${String(data.decisionId).slice(0, 8)}…).`);
      const refreshed = await fetchDecisions();
      setDecisions(refreshed.decisions);
      setDecisionsAreMock(refreshed.isMock);
    } catch (err) {
      setPersistMsg(
        err instanceof Error ? `Not persisted: ${err.message}` : "Not persisted."
      );
    } finally {
      setPersisting(false);
    }
  };

  const startElicit = () => {
    if (!situation.trim()) return;
    setError("");
    setPhase("elicit");
  };

  const requestSystemResponse = async () => {
    if (!userDiagnosis.trim() || !userProposal.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/decision-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, userDiagnosis, userProposal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate a response.");
      setResponse(data);
      setPhase("respond");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Decision Dialogue"
        subtitle={`${mockCompany.name} · Guide, don't overtake (CLAUDE.md §3.3)`}
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Constitution banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#5470ff]/5 border border-[#5470ff]/20">
          <Brain className="w-4 h-4 text-[#7a96ff] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#8895c4] leading-relaxed">
            The System will not assert a decision until you state your own diagnosis and
            proposal. This is the structural interrupt that prevents the System from
            overtaking you and turns the interaction into a dialogue instead of a directive.
            See <a href="/docs/GUIDE_DONT_OVERTAKE.md" className="text-[#7a96ff] underline">the rule</a>.
          </p>
        </div>

        {/* Phase indicator */}
        <PhaseStepper current={phase} />

        {/* Phase 1 — Situation */}
        <PhaseCard
          active={phase === "situation"}
          number="1"
          title="Situation"
          subtitle="Describe what's happening. The System is silent."
        >
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            disabled={phase !== "situation"}
            rows={5}
            className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-3 text-sm text-[#8895c4] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
          />
          {phase === "situation" && (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={startElicit}
                disabled={!situation.trim()}
                className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </PhaseCard>

        {/* Phase 2 — Elicit */}
        {phase !== "situation" && (
          <PhaseCard
            active={phase === "elicit"}
            number="2"
            title="Your read"
            subtitle="The System will not respond until you've stated both."
          >
            <div className="space-y-4">
              <ElicitField
                icon={<CircleHelp className="w-3.5 h-3.5" />}
                label="What do you think is actually going on?"
                value={userDiagnosis}
                onChange={setUserDiagnosis}
                disabled={phase !== "elicit"}
                placeholder="Diagnose the situation in your own words. The underlying cause, not just the symptom."
              />
              <ElicitField
                icon={<Lightbulb className="w-3.5 h-3.5" />}
                label="What would you do, and why?"
                value={userProposal}
                onChange={setUserProposal}
                disabled={phase !== "elicit"}
                placeholder="State your proposal. The action AND the reasoning — what makes this the right move."
              />
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            {phase === "elicit" && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setPhase("situation")}
                  className="text-xs text-[#5a6399] hover:text-[#8895c4] transition-colors"
                >
                  ← back to situation
                </button>
                <button
                  onClick={requestSystemResponse}
                  disabled={
                    loading || !userDiagnosis.trim() || !userProposal.trim()
                  }
                  className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                >
                  <MessageCircleQuestion className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
                  {loading ? "Asking the System…" : "Ask the System"}
                </button>
              </div>
            )}
          </PhaseCard>
        )}

        {/* Phase 3 — Respond */}
        {response && (
          <PhaseCard
            active={phase === "respond"}
            number="3"
            title="System response"
            subtitle="Engagement first, then perspective, then a suggestion with WHY."
          >
            <div className="space-y-5">
              <ResponseBlock
                label="Engages your diagnosis"
                color="emerald"
                body={response.engagement}
              />
              {response.addedPerspective?.trim() && (
                <ResponseBlock
                  label="Adds perspective"
                  color="blue"
                  body={response.addedPerspective}
                />
              )}
              <div className="rounded-xl border border-[#5470ff]/30 bg-[#5470ff]/5 p-5">
                <p className="text-[10px] text-[#7a96ff] uppercase tracking-widest mb-2">
                  Suggestion
                </p>
                <p className="text-sm font-medium text-[#e8eaf6] mb-3 leading-snug">
                  {response.suggestion.action}
                </p>
                <p className="text-[10px] text-[#5a6399] uppercase tracking-widest mb-1">
                  Why
                </p>
                <p className="text-xs text-[#8895c4] leading-relaxed">
                  {response.suggestion.why}
                </p>
              </div>
              <ResponseBlock
                label="Compared to your proposal"
                color="violet"
                body={response.comparison}
                icon={<GitCompareArrows className="w-3.5 h-3.5" />}
              />
            </div>

            {phase === "respond" && (
              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={() => setPhase("elicit")}
                  className="text-xs text-[#5a6399] hover:text-[#8895c4] transition-colors"
                >
                  ← revise my read
                </button>
                <button
                  onClick={() => setPhase("decide")}
                  className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                >
                  Decide <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </PhaseCard>
        )}

        {/* Phase 4 — Decide */}
        {phase === "decide" && response && (
          <PhaseCard
            active={true}
            number="4"
            title="Decide and record"
            subtitle="The dialogue is preserved with the outcome. The WHY survives the moment."
          >
            <div className="space-y-3">
              <DecisionChoice
                label="Go with my proposal"
                description="Your original proposal stands. The System's perspective is on record but not adopted."
                selected={decision?.kind === "user"}
                onSelect={() => setDecision({ kind: "user", note: userProposal })}
              />
              <DecisionChoice
                label="Go with the System's suggestion"
                description="Adopt the System's suggestion as-is. The why is preserved."
                selected={decision?.kind === "system"}
                onSelect={() =>
                  setDecision({ kind: "system", note: response.suggestion.action })
                }
              />
              <DecisionChoice
                label="Hybrid"
                description="Combine elements of both. Describe what you're actually doing."
                selected={decision?.kind === "hybrid"}
                onSelect={() => setDecision({ kind: "hybrid", note: "" })}
              />
              <DecisionChoice
                label="Defer — not enough understanding yet"
                description="Per Rule 0, an unearned decision is worse than no decision. Capture this state and return later."
                selected={decision?.kind === "defer"}
                onSelect={() => setDecision({ kind: "defer", note: "" })}
              />

              {decision && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-200">
                      Choice noted ({decision.kind}).
                    </p>
                  </div>
                  <p className="text-xs text-[#8895c4]">
                    The full dialogue — situation, your diagnosis, your proposal, the
                    System&apos;s response, and this choice — can be persisted now so the
                    WHY survives past the moment.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={persistDecision}
                      disabled={persisting || !supabaseEnabled}
                      className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-200 font-semibold px-4 py-2 rounded-lg transition-all text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {persisting
                        ? "Persisting…"
                        : supabaseEnabled
                        ? "Persist dialogue"
                        : "Persist (live mode only)"}
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 text-xs text-[#7a96ff] hover:text-white"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Start a new dialogue
                    </button>
                  </div>
                  {persistMsg && (
                    <p className="mt-2 text-xs text-[#8895c4]">{persistMsg}</p>
                  )}
                </div>
              )}
            </div>
          </PhaseCard>
        )}

        {/* Decision Memory */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#e8eaf6]">Decision Memory</h2>
            <span className="text-xs text-[#5a6399]">
              {decisions.length} decisions stored
              {decisionsAreMock ? " (demo — no live data yet)" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#12141f] border border-[#252840]"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#5470ff] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[#e8eaf6]">{d.title}</p>
                    <p className="text-xs text-[#5a6399] mt-0.5">
                      {d.date} · {d.outcome}
                      {d.hasDialogue && (
                        <span className="ml-2 text-emerald-400">· dialogue preserved</span>
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    d.executionStatus === "In Progress"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : d.executionStatus === "Blocked"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : d.executionStatus === "Deferred"
                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {d.executionStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function PhaseStepper({ current }: { current: Phase }) {
  const order: Phase[] = ["situation", "elicit", "respond", "decide"];
  const labels = {
    situation: "Situation",
    elicit: "Your read",
    respond: "System",
    decide: "Decide",
  };
  return (
    <div className="flex items-center gap-2">
      {order.map((p, i) => {
        const reached = order.indexOf(current) >= i;
        const active = current === p;
        return (
          <div key={p} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-[#5470ff]/15 border-[#5470ff]/50 text-[#7a96ff]"
                  : reached
                  ? "border-[#252840] text-[#8895c4]"
                  : "border-[#252840] text-[#3a3f5c]"
              }`}
            >
              <span className="font-mono">{i + 1}</span>
              {labels[p]}
            </div>
            {i < order.length - 1 && (
              <ChevronRight className="w-3 h-3 text-[#3a3f5c]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhaseCard({
  active,
  number,
  title,
  subtitle,
  children,
}: {
  active: boolean;
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`glass-card p-5 transition-opacity ${active ? "" : "opacity-60"}`}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-mono text-[#5470ff]">PHASE {number}</span>
        <h2 className="text-sm font-semibold text-[#e8eaf6]">{title}</h2>
      </div>
      <p className="text-xs text-[#5a6399] mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function ElicitField({
  icon,
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-[#8895c4] mb-1.5">
        <span className="text-[#7a96ff]">{icon}</span>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        placeholder={placeholder}
        className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-3 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
      />
    </div>
  );
}

function ResponseBlock({
  label,
  body,
  color,
  icon,
}: {
  label: string;
  body: string;
  color: "emerald" | "blue" | "violet";
  icon?: React.ReactNode;
}) {
  const styles = {
    emerald: "bg-emerald-500/5 border-emerald-500/20 text-emerald-300",
    blue: "bg-blue-500/5 border-blue-500/20 text-blue-300",
    violet: "bg-violet-500/5 border-violet-500/20 text-violet-300",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-2 opacity-80">
        {icon}
        {label}
      </p>
      <p className="text-sm text-[#e8eaf6] leading-relaxed">{body}</p>
    </div>
  );
}

function DecisionChoice({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected
          ? "border-[#5470ff]/60 bg-[#5470ff]/10"
          : "border-[#252840] bg-[#12141f] hover:border-[#3a3f5c]"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#7a96ff]" />}
        <span className="text-sm font-medium text-[#e8eaf6]">{label}</span>
      </div>
      <p className="text-xs text-[#5a6399] leading-relaxed">{description}</p>
    </button>
  );
}
